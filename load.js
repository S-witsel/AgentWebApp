import { AzureChatOpenAI, AzureOpenAIEmbeddings  } from "@langchain/openai";
import { createAgent } from "langchain";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});
const vectorStore = await FaissStore.load("./documents", embeddings);
//console.log("✅ vector store loaded!")

const prompt = "how many films are there in your vector database?";
const relevantDocs = await vectorStore.similaritySearch(prompt, 5);
const context = relevantDocs.map(doc => doc.pageContent).join("\n\n")

//console.log(`Found ${relevantDocs.length} relevant documents`)
//console.log(context)

const model = new AzureChatOpenAI({ temperature: 0.2 });
const agent = createAgent({model, system: "you are a helpful assistant" });

const result = await agent.invoke({
    messages: [{ role: "user", content: `give using this context: ${context} a response to this question: ${prompt}` }],
});

console.log(result.messages.at(-1).content)