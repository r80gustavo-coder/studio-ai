import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(request: Request) {
  console.log("Recebi uma chamada na API...");

  try {
    // 1. Diagnóstico de Chave
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error("ERRO GRAVE: REPLICATE_API_TOKEN não foi encontrado nas variáveis de ambiente.");
      return NextResponse.json({ error: "ERRO DE CONFIGURAÇÃO: A chave REPLICATE_API_TOKEN não foi configurada na Vercel." }, { status: 500 });
    }

    // 2. Configuração do Replicate
    const replicate = new Replicate({
      auth: token,
    });

    const body = await request.json();
    
    // MODO 1: CHECAR STATUS
    if (body.predictionId) {
      const prediction = await replicate.predictions.get(body.predictionId);
      return NextResponse.json(prediction);
    }

    // MODO 2: CRIAR NOVA IMAGEM
    const { human_img, garm_img, category } = body;

    if (!human_img || !garm_img) {
      return NextResponse.json({ error: "Imagens faltando na requisição" }, { status: 400 });
    }

    console.log("Iniciando geração no Replicate...");
    
    const prediction = await replicate.predictions.create({
      version: "c871bb9b046607428d795a5f08d2387775c74209",
      input: {
        human_img,
        garm_img,
        category: category || "upper_body",
        crop: false,
        steps: 30
      }
    });

    console.log("Geração iniciada com ID:", prediction.id);
    return NextResponse.json(prediction);

  } catch (error: any) {
    console.error("Erro DETALHADO no Replicate:", error);
    return NextResponse.json({ error: error.message || "Erro interno desconhecido" }, { status: 500 });
  }
}
