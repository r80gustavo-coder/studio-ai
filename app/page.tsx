"use client";

import React, { useState, useEffect } from 'react';
import { Upload, Shirt, User, Wand2, Settings, Loader2, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- TIPAGEM (CRUCIAL PARA PASSAR NO BUILD DA VERCEL) ---
interface AlertProps {
  children: React.ReactNode;
  type?: 'info' | 'error';
}

// --- COMPONENTES UI ---
const Alert = ({ children, type = 'info' }: AlertProps) => (
  <div className={`p-4 rounded-lg border flex items-start gap-3 mb-4 ${
    type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }`}>
    <div className="mt-0.5">{type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}</div>
    <div className="text-sm">{children}</div>
  </div>
);

export default function Home() {
  // --- ESTADOS COM TIPAGEM CORRETA ---
  const [activeTab, setActiveTab] = useState<string>('studio'); 
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  
  const [garmentImage, setGarmentImage] = useState<File | null>(null); 
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<File | null>(null); 
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('upper_body');

  const [config, setConfig] = useState({ supabaseUrl: '', supabaseKey: '' });
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [gallery, setGallery] = useState<any[]>([]); // 'any' permitido aqui para simplificar
  const [systemError, setSystemError] = useState<{title: string, msg: string} | null>(null);

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    // Carrega configs salvas no navegador para não precisar digitar sempre
    const savedUrl = localStorage.getItem('sb_url');
    const savedKey = localStorage.getItem('sb_key');
    if (savedUrl && savedKey) setConfig({ supabaseUrl: savedUrl, supabaseKey: savedKey });
  }, []);

  useEffect(() => {
    if (config.supabaseUrl && config.supabaseKey) {
      try {
        const client = createClient(config.supabaseUrl, config.supabaseKey);
        setSupabase(client);
        fetchGallery(client);
        localStorage.setItem('sb_url', config.supabaseUrl);
        localStorage.setItem('sb_key', config.supabaseKey);
      } catch (e) {
        console.error("Erro Supabase init", e);
      }
    }
  }, [config.supabaseUrl, config.supabaseKey]);

  // --- LÓGICA ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'garment' | 'model') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'garment') { setGarmentImage(file); setGarmentPreview(previewUrl); }
    else { setModelImage(file); setModelPreview(previewUrl); }
  };

  // Função de Upload para o Supabase
  const uploadToSupabase = async (client: SupabaseClient, path: string, file: File) => {
    // Tenta fazer o upload
    const { error } = await client.storage.from('studio').upload(path, file);
    
    // Se der erro, verifica se é porque o arquivo já existe, se for, tudo bem
    if (error && (error as any).statusCode !== "409" && !error.message.includes("already exists")) {
       throw error;
    }
    
    const { data: publicUrl } = client.storage.from('studio').getPublicUrl(path);
    return publicUrl.publicUrl;
  };

  // Chama o nosso Backend (API Route) para esconder a chave do Replicate
  const callBackendAPI = async (garmentUrl: string, modelUrl: string) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        human_img: modelUrl,
        garm_img: garmentUrl,
        category: category
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Erro ao conectar com API");
    }
    
    const result = await response.json();
    return result; // O Replicate retorna a URL da imagem gerada
  };

  // Fluxo Principal de Geração
  const handleGenerate = async () => {
    if (!garmentImage || !modelImage) return alert("Faltam imagens!");
    if (!supabase) return alert("Configure o Supabase na aba Configurações primeiro!");
    
    setLoading(true);
    setSystemError(null);
    setStatusMsg("Enviando imagens para a nuvem...");

    try {
      const cleanName = (n: string) => n.replace(/[^a-zA-Z0-9.]/g, '');
      const timestamp = Date.now();
      const gPath = `g_${timestamp}_${cleanName(garmentImage.name)}`;
      const mPath = `m_${timestamp}_${cleanName(modelImage.name)}`;

      // 1. Upload
      const gUrl = await uploadToSupabase(supabase, gPath, garmentImage);
      const mUrl = await uploadToSupabase(supabase, mPath, modelImage);

      // 2. Processamento IA
      setStatusMsg("Processando com IA (Pode demorar 30s)...");
      const finalUrl = await callBackendAPI(gUrl, mUrl);

      setResultImage(finalUrl);

      // 3. Salvar no Histórico
      await supabase.from('catalog').insert({
        garment_url: gUrl, model_url: mUrl, result_url: finalUrl 
      });
      fetchGallery(supabase);

    } catch (error: any) {
      console.error(error);
      setSystemError({ title: "Erro", msg: error.message || "Erro desconhecido" });
    } finally {
      setLoading(false);
    }
  };

  const fetchGallery = async (client: SupabaseClient) => {
    const { data } = await client.from('catalog').select('*').order('created_at', { ascending: false });
    if (data) setGallery(data);
  };

  // --- RENDERIZAÇÃO (O QUE APARECE NA TELA) ---
  return (
    <div className="min-h-screen bg-[#0f0f12] text-white font-sans p-6">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wand2 className="text-purple-500"/> Nexus Studio <span className="text-xs bg-white/10 px-2 rounded">IDM-VTON</span>
        </h1>
        <nav className="flex gap-2">
          {['studio', 'gallery', 'settings'].map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-1 rounded capitalize ${activeTab===t?'bg-white/20':'text-gray-400'}`}>{t}</button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto">
        {systemError && <Alert type="error">{systemError.msg}</Alert>}

        {activeTab === 'studio' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Coluna da Esquerda: Inputs */}
            <div className="space-y-6">
              <div className="bg-[#18181b] p-4 rounded-xl border border-white/10">
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase">Categoria</h3>
                <div className="flex gap-2">
                  {[{id:'upper_body', l:'Cima'}, {id:'lower_body', l:'Baixo'}, {id:'dresses', l:'Vestido'}].map(c => (
                    <button key={c.id} onClick={()=>setCategory(c.id)} className={`flex-1 py-2 text-xs rounded border ${category===c.id?'border-purple-500 text-purple-400 bg-purple-500/10':'border-transparent bg-black/20 text-gray-400'}`}>{c.l}</button>
                  ))}
                </div>
              </div>

              {/* Upload Roupa */}
              <div className="bg-[#18181b] p-6 rounded-xl border border-white/10 relative group mb-4">
                 <div className="flex justify-between mb-4 text-sm text-gray-300 font-medium">
                    <span className="flex gap-2 items-center"><Shirt size={16}/> Roupa</span>
                    {garmentPreview && <CheckCircle2 className="text-green-500" size={16}/>}
                 </div>
                 <div className="h-48 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center relative bg-black/20 hover:bg-white/5 transition overflow-hidden">
                    {garmentPreview ? <img src={garmentPreview} className="h-full object-contain" alt="Roupa"/> : <Upload className="text-gray-600"/>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(e, 'garment')}/>
                 </div>
              </div>

              {/* Upload Modelo */}
              <div className="bg-[#18181b] p-6 rounded-xl border border-white/10 relative group">
                 <div className="flex justify-between mb-4 text-sm text-gray-300 font-medium">
                    <span className="flex gap-2 items-center"><User size={16}/> Modelo</span>
                    {modelPreview && <CheckCircle2 className="text-green-500" size={16}/>}
                 </div>
                 <div className="h-48 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center relative bg-black/20 hover:bg-white/5 transition overflow-hidden">
                    {modelPreview ? <img src={modelPreview} className="h-full object-contain" alt="Modelo"/> : <Upload className="text-gray-600"/>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(e, 'model')}/>
                 </div>
              </div>
            </div>

            {/* Coluna da Direita: Resultado */}
            <div className="lg:col-span-2 bg-[#18181b] rounded-xl border border-white/10 p-2 flex flex-col min-h-[500px]">
              <div className="flex-1 bg-black/40 rounded-lg relative flex items-center justify-center overflow-hidden">
                {!resultImage && !loading && <div className="text-gray-600 flex flex-col items-center"><Layers size={48} className="mb-4 opacity-50"/><p>Aguardando geração...</p></div>}
                {loading && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10"><Loader2 className="animate-spin text-purple-500 mb-2" size={32}/><p className="text-purple-400 animate-pulse text-sm">{statusMsg}</p></div>}
                {resultImage && !loading && <img src={resultImage} className="max-h-full max-w-full object-contain" alt="Resultado"/>}
              </div>
              <div className="h-16 flex items-center justify-end px-4 border-t border-white/5 mt-2">
                <button onClick={handleGenerate} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold flex gap-2 disabled:opacity-50">
                  <Wand2 size={18}/> Gerar Prova
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gallery.map((i: any) => (
              <div key={i.id} className="aspect-[3/4] bg-gray-800 rounded overflow-hidden relative group">
                <img src={i.result_url} className="w-full h-full object-cover" alt="Galeria"/>
                <a href={i.result_url} target="_blank" className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition text-white text-xs">Abrir Original</a>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-lg mx-auto bg-[#18181b] p-8 rounded-xl border border-white/10 space-y-4">
            <h2 className="font-bold flex gap-2"><Settings/> Configurações</h2>
            <div>
              <label className="text-xs font-bold text-gray-500">Supabase URL</label>
              <input value={config.supabaseUrl} onChange={e=>setConfig({...config, supabaseUrl: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm text-white"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">Supabase Anon Key</label>
              <input type="password" value={config.supabaseKey} onChange={e=>setConfig({...config, supabaseKey: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm text-white"/>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
              Nota: A chave do Replicate agora deve ser configurada nas <strong>Variáveis de Ambiente (Environment Variables)</strong> no site da Vercel, e não aqui.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
