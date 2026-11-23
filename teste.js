require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

console.log("🔍 Consultando os servidores do Google...\n");

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            console.error("❌ Erro na chave:", data.error.message);
            return;
        }
        
        console.log("✅ Modelos disponíveis para a sua chave exata:");
        // Filtra apenas os modelos que suportam geração de conteúdo (text/pdf)
        const modelosUteis = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        
        modelosUteis.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')}`);
        });
        
        console.log("\n💡 Copie um dos nomes acima (ex: gemini-1.5-...) e coloque no seu index.js!");
    })
    .catch(err => console.error("Erro de rede:", err));