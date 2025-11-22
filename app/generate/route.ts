import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // MODO 1: CHECAR STATUS (Se receber um ID, verifica se tá pronto)
    if (body.predictionId) {
      const prediction = await replicate.predictions.get(body.predictionId);
      return NextResponse.json(prediction);
    }

    // MODO 2: CRIAR NOVA IMAGEM (Se receber imagens, manda criar)
    const { human_img, garm_img, category } = body;

    if (!human_img || !garm_img) {
      return NextResponse.json({ error: "Imagens faltando" }, { status: 400 });
    }

    // Nota: Usamos predictions.create em vez de run para não travar a Vercel
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

    return NextResponse.json(prediction);

  } catch (error: any) {
    console.error("Erro no Replicate:", error);
    return NextResponse.json({ error: error.message || "Falha interna" }, { status: 500 });
  }
}
