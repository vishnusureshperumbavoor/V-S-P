import { client } from "@gradio/client";

async function getResponse(userMessage) {
  const app = await client(
    "https://vishnusureshperumbavoor-vspbot-falcon-langchain.hf.space/"
  );
  const result = await app.predict("/predict", [userMessage]);
  return result.data;
}