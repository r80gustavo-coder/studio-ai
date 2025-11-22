import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { human_img, garm_img, category } = await request.json();

    if (!human_img || !garm_img) {
      return NextResponse.json({ error: "Imagens faltando" }, { status: 400 });
    }

    // Chama o modelo IDM-VTON
    const output = await replicate.run(
      "cuuupid/idm-vton:c871bb9b046607428d795a5f08d2387775c74209",
      {
        input: {
          human_img,
          garm_img,
          category: category || "upper_body",
          crop: false,
          steps: 30
        }
      }
    );

    return NextResponse.json(output);
  } catch (error) {
    console.error("Erro no Replicate:", error);
    return NextResponse.json({ error: "Falha na geração" }, { status: 500 });
  }
}