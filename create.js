import fs from "fs/promises";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

// laad alle tekstbestanden uit de originals-map
const originalsDir = "./public/originals";
const files = await fs.readdir(originalsDir);
const txtFiles = files.filter((file) => file.toLowerCase().endsWith(".txt"));

if (txtFiles.length === 0) {
  throw new Error(`No .txt files found in ${originalsDir}`);
}

const docsArrays = await Promise.all(
  txtFiles.map((file) => new TextLoader(`${originalsDir}/${file}`).load())
);
const docs = docsArrays.flat();

// opsplitsen
const textSplitter = new RecursiveCharacterTextSplitter({chunkSize: 2000, chunkOverlap: 400 });
const chunks = await textSplitter.splitDocuments(docs);

// log
console.log(`Er zijn ${chunks.length} chunks. De eerste chunk is:`);
console.log(chunks[0]);

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

console.log("Creating vector store...")

const vectorStore = new FaissStore(embeddings, {});
await vectorStore.addDocuments(chunks);
await vectorStore.save("./documents");   // directory name
console.log("✅ vector store saved!")