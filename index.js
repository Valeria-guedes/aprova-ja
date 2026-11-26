require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// 1. Cria a pasta do banco de dados automaticamente se não existir
const pastaBanco = path.join(__dirname, 'banco_questoes');
if (!fs.existsSync(pastaBanco)) {
    fs.mkdirSync(pastaBanco);
}

// 2. Dicionário visual para as matérias (Ícones e Descrições)
const configVisual = {
    "Língua Portuguesa": { time: 60, desc: "Ortografia, Gramática e Interpretação", icon: `<svg class="h-10 w-10 text-blue-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>` },
    "Raciocínio Lógico-Mat.": { time: 60, desc: "Lógica, Sequências e Problemas", icon: `<svg class="h-10 w-10 text-purple-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>` },
    "Realidade de GO": { time: 60, desc: "História e Geografia Regional", icon: `<svg class="h-10 w-10 text-yellow-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>` },
    "Conhecimentos Específicos": { time: 60, desc: "Direito, Leis e Adm. Pública", icon: `<svg class="h-10 w-10 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>` },
    "Padrao": { time: 60, desc: "Questões variadas", icon: `<svg class="h-10 w-10 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>` }
};

async function processarPDF(caminhoPdf, materia, peso) {
    console.log(`\n⏳ Fazendo upload do PDF para a IA: ${caminhoPdf}...`);

    try {
        const uploadResult = await fileManager.uploadFile(caminhoPdf, {
            mimeType: "application/pdf",
            displayName: "Prova",
        });
        
        console.log(`🧠 Upload feito! Extraindo as questões... (Aguarde)`);

        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        
        const prompt = `
            Extraia todas as questões de múltipla escolha deste PDF.
            Retorne APENAS um array JSON válido, sem markdown (\`\`\`json), nesta estrutura:
            [
              {
                "materia": "${materia}",
                "peso": ${peso},
                "text": "Texto da pergunta",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": 0,
                "explanation": "Explicação detalhada."
              }
            ]
        `;

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
            { text: prompt }
        ]);

        let respostaIA = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        
        // 3. Salva o JSON na pasta do banco
        const nomeArquivoSaida = path.join(pastaBanco, `lote_${materia.replace(/\s+/g, '_')}_${Date.now()}.json`);
        fs.writeFileSync(nomeArquivoSaida, respostaIA);
        
        console.log(`✅ Lote de '${materia}' salvo com sucesso!`);
        
        // 4. CHAMA O GERADOR AUTOMÁTICO DO APP
        atualizarAplicativo();

    } catch (error) {
        console.error("\n❌ Erro:", error.message);
    }
}

function atualizarAplicativo() {
    console.log(`\n⚙️ Compilando banco de dados e atualizando o App...`);
    
    const arquivos = fs.readdirSync(pastaBanco).filter(f => f.endsWith('.json'));
    let todasAsQuestoes = [];
    let questoesPorMateria = {};

    // Lê todos os JSONs da pasta e agrupa
    arquivos.forEach(arq => {
        try {
            const arr = JSON.parse(fs.readFileSync(path.join(pastaBanco, arq), 'utf-8'));
            todasAsQuestoes.push(...arr);
            
            arr.forEach(q => {
                if (!questoesPorMateria[q.materia]) questoesPorMateria[q.materia] = [];
                questoesPorMateria[q.materia].push(q);
            });
        } catch (e) {
            console.log(`Aviso: Não foi possível ler o arquivo ${arq}`);
        }
    });

    // Constrói o texto do arquivo dados.js
    let dadosJsOutput = `// ARQUIVO GERADO AUTOMATICAMENTE PELO MOTOR (NÃO EDITE MANUALMENTE)\n\nconst quizData = {\n`;
    
    // Adiciona a caixa do Simulado Geral
    dadosJsOutput += `    "geral": {
        title: "Simulado Geral Completo",
        desc: "Todas as disciplinas do edital",
        timeMin: 120,
        icon: \`<svg class="h-10 w-10 text-slate-800 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>\`,
        questions: ${JSON.stringify(todasAsQuestoes, null, 4)}
    },\n`;

    // Adiciona as caixas de cada Matéria dinamicamente
    let idKey = 1;
    for (const [nomeMateria, questoes] of Object.entries(questoesPorMateria)) {
        let visual = configVisual[nomeMateria] || configVisual["Padrao"];
        
        dadosJsOutput += `    "materia_${idKey}": {
        title: "${nomeMateria}",
        desc: "${visual.desc}",
        timeMin: ${visual.time},
        icon: \`${visual.icon}\`,
        questions: ${JSON.stringify(questoes, null, 4)}
    },\n`;
        idKey++;
    }

    dadosJsOutput += `};\n`;

    // Sobrescreve o arquivo dados.js oficial do aplicativo
    fs.writeFileSync(path.join(__dirname, 'dados.js'), dadosJsOutput);
    console.log(`🚀 APP ATUALIZADO! O arquivo 'dados.js' agora contém ${todasAsQuestoes.length} questões no total.`);
    console.log(`Basta atualizar a página no seu navegador para ver as mudanças.`);
}

// ==========================================
// CONFIGURAÇÃO DA EXECUÇÃO
// ==========================================
// Troque o nome do PDF e da matéria que deseja extrair agora:
//processarPDF('./raciociologico-38-52.pdf', 'Raciocínio Lógico-Mat.', 4);

// DICA: Se você quiser apenas juntar os JSONs que já estão na pasta sem mandar um PDF novo para a IA,
// basta comentar a linha processarPDF(...) acima, e descomentar a linha abaixo:
atualizarAplicativo(function atualizarAplicativo() {
    console.log(`\n⚙️ Compilando banco de dados e atualizando o App...`);
    
    const arquivos = fs.readdirSync(pastaBanco).filter(f => f.endsWith('.json'));
    let todasAsQuestoes = [];

    // Lê todos os JSONs da pasta e agrupa as 872 questões numa única lista
    arquivos.forEach(arq => {
        try {
            const arr = JSON.parse(fs.readFileSync(path.join(pastaBanco, arq), 'utf-8'));
            todasAsQuestoes.push(...arr);
        } catch (e) {
            console.log(`Aviso: Não foi possível ler o arquivo ${arq}`);
        }
    });

    // Constrói o texto do arquivo dados.js EXATAMENTE como o seu novo HTML precisa
    let dadosJsOutput = `// ARQUIVO GERADO AUTOMATICAMENTE PELO MOTOR (NÃO EDITE MANUALMENTE)\n\n`;
    
    // Agora exportamos apenas o array puro bancoDeQuestoes
    dadosJsOutput += `const bancoDeQuestoes = ${JSON.stringify(todasAsQuestoes, null, 4)};\n`;

    // Sobrescreve o arquivo dados.js oficial do aplicativo
    fs.writeFileSync(path.join(__dirname, 'dados.js'), dadosJsOutput);
    console.log(`🚀 APP ATUALIZADO! O arquivo 'dados.js' agora contém ${todasAsQuestoes.length} questões no total.`);
    console.log(`Basta atualizar a página no seu navegador para ver as mudanças e testar o Simulado Geral de 4h.`);
});