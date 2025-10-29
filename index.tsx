
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality, Type, Content } from "@google/genai";
import { marked } from 'marked';

// --- DATA ---
const herbicideData = {
  legend: [
    { code: "K1", desc: "Grupo 3 (trifluralin)" },
    { code: "K3", desc: "Grupo 15 (propisochlor/pyroxasulfone)" },
    { code: "F1", desc: "Grupo 12 (diflufenican)" },
    { code: "C3", desc: "Grupo 6 (bromoxynil)" },
    { code: "C2", desc: "Grupo 5 (isoproturon)" },
    { code: "A", desc: "Grupo 1 (ACCase: pinoxaden, clodinafop, tralkoxydim)" },
    { code: "B", desc: "Grupo 2 (ALS: metsulfuron, triasulfuron, pyroxsulam*)" },
    { code: "O", desc: "Grupo 4 (2,4-D, MCPA)" },
    { code: "8", desc: "Grupo 8 (triallate)" },
  ],
  crops: [
    {
      name: "Trigo Candeal",
      stages: [
        { bbch: "00–09", title: "Pre-siembra / Pre-emergencia (PPI/PRE)", content: `• <strong>K1</strong> Trifluralin → TREFLAN® EC<br>• <strong>K3+F1</strong> Propisochlor + Diflufenican → BINOMIO® 230 EC<br>• <strong>8</strong> Triallate → (si disponible)` },
        { bbch: "10–14", title: "Post-emergencia Temprana (1–4 hojas)", content: `• <strong>F1</strong> Diflufenican → VIVAZ® 500 SC<br>• <strong>C3+O</strong> Bromoxynil + MCPA → MCPA 750 SL + bromoxynil comercial<br>• <strong>B</strong> ALS (metsulfuron/triasulfuron) → LOGRAN® 75 WG<br>• <strong>A</strong> ACCase (gramíneas) → AXIAL® 050 EC` },
        { bbch: "20–29", title: "Macollaje (Tillering)", content: `• <strong>A</strong> ACCase → AXIAL® 050 EC | TOPIK® 240 EC<br>• <strong>B</strong> ALS → LOGRAN® 75 WG / productos con pyroxsulam*<br>• <strong>O</strong> 2,4-D / MCPA → ARCO® 2,4-D 480 SL / MCPA 750 SL<br>• <strong>C3</strong> Bromoxynil → BROMOTRIL®<br><em>Secuencia sugerida: A → (7–10 d) → O o C3+O</em>` },
        { bbch: "30–32", title: "Inicio Encañado", content: `Ventanas estrechas; respetar etiquetas: A (acotado), O (cuidar estado), B (solo si permitido)` },
      ],
      note: "No usar en DURUM: C2 Isoproturon (p.ej. FUEGO® 50 SC) por fitotoxicidad histórica."
    },
    {
      name: "Trigo Pan",
      stages: [
        { bbch: "00–09", title: "PPI/PRE", content: `• <strong>K1</strong> TREFLAN® EC<br>• <strong>K3+F1</strong> BINOMIO® 230 EC<br>• <strong>C2</strong> FUEGO® 50 SC (isoproturon)` },
        { bbch: "10–14", title: "Post-emergencia Temprana", content: `• <strong>F1</strong> VIVAZ® 500 SC<br>• <strong>C3+O</strong> Bromoxynil + MCPA<br>• <strong>B</strong> ALS → LOGRAN® 75 WG<br>• <strong>A</strong> ACCase → AXIAL® 050 EC / TOPIK® 240 EC` },
        { bbch: "20–29", title: "Macollaje", content: `• <strong>A</strong> ACCase → AXIAL® / TOPIK®<br>• <strong>B</strong> ALS mixes<br>• <strong>O</strong> 2,4-D / MCPA<br>• <strong>C3</strong> Bromoxynil` },
        { bbch: "30–32", title: "Inicio Encañado", content: `A (ventana estrecha) | O (cuidado de timing) | B (algunas ventanas cierran—seguir etiqueta)` },
      ]
    },
    {
      name: "Cebada",
      stages: [
        { bbch: "00–09", title: "PPI/PRE", content: `• <strong>K1</strong> TREFLAN® EC<br>• <strong>K3+F1</strong> BINOMIO® 230 EC` },
        { bbch: "10–14", title: "Post-emergencia Temprana", content: `• <strong>F1</strong> VIVAZ® 500 SC<br>• <strong>C3+O</strong> (MCPA 750 SL + bromoxynil)<br>• <strong>A</strong> DIMs (p.ej. tralkoxydim)*<br><em>*Ver etiqueta específica para cebada.</em>` },
        { bbch: "20–29", title: "Macollaje", content: `• <strong>A</strong> (preferir DIMs en cebada)<br>• <strong>O</strong><br>• <strong>C3</strong>` },
        { bbch: "30–32", title: "Inicio Encañado", content: `Ventanas muy acotadas; revisar etiqueta antes de aplicar` },
      ]
    },
    {
      name: "Avena",
      stages: [
        { bbch: "00–09", title: "PPI/PRE", content: `• <strong>K1</strong> TREFLAN® EC<br>• <strong>8</strong> Triallate (si disponible/etiqueta)` },
        { bbch: "10–14", title: "Post-emergencia Temprana", content: `• <strong>O</strong> (MCPA 750 SL)<br>• <strong>C3</strong> (bromoxynil)<br><em>(ACCase generalmente NO selectivo en avena)</em>` },
        { bbch: "20–29", title: "Macollaje", content: `• <strong>O + C3</strong> limpiezas<br>• ALS limitado—revisar etiquetas locales` },
        { bbch: "30–32", title: "Inicio Encañado", content: `Ventanas post se cierran; priorizar aplicaciones tempranas` },
      ]
    }
  ]
};

// --- API & HELPERS ---
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

const fileToGenerativePart = async (file) => {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

function decode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


// --- COMPONENTS ---

const LoadingSpinner = ({ text }) => (
    <div className="loading-overlay">
        <div className="spinner"></div>
        {text && <p>{text}</p>}
    </div>
);

const ChatModal = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [image, setImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    
    const audioContextRef = useRef(null);
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{ 
                role: 'bot', 
                text: 'Hola! Soy tu asistente de agronomía. ¿En qué puedo ayudarte hoy sobre el control de malezas en cereales? Puedes subir una foto de una maleza para identificarla.',
                id: Date.now()
            }]);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCurrentLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.warn("No se pudo obtener la ubicación:", error.message);
                }
            );
        }
    }, [isOpen]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() && !image) return;
        const userInputText = input.trim();
        const userMessage = { 
            role: 'user', 
            text: userInputText, 
            image: image ? URL.createObjectURL(image) : null,
            id: Date.now() 
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setImage(null);
        setIsLoading(true);

        try {
            const systemInstruction = `Eres un asistente experto en agronomía, especializado en el control de malezas en cereales en Chile. Tu base de conocimiento principal es la siguiente información: ${JSON.stringify(herbicideData)}. Responde las preguntas de los usuarios de forma concisa y precisa, en español. Si el usuario sube una imagen, identifica la maleza (si es posible) y sugiere métodos de control relevantes para Chile. Si se pregunta por proveedores o información local, utiliza la herramienta de Google Maps. No respondas preguntas fuera de este tema.`;

            const history = messages
                .filter(msg => msg.role !== 'bot' || msg.text !== 'Hola! Soy tu asistente de agronomía. ¿En qué puedo ayudarte hoy sobre el control de malezas en cereales? Puedes subir una foto de una maleza para identificarla.') // Exclude initial message
                .map(msg => ({
                    role: msg.role === 'bot' ? 'model' : 'user',
                    parts: [{ text: msg.text }]
                }));

            const currentUserParts = [];
            if (image) {
                const imagePart = await fileToGenerativePart(image);
                currentUserParts.push(imagePart);
            }
            if(userInputText){
                currentUserParts.push({ text: userInputText });
            }

            const contents = [...history, { role: 'user', parts: currentUserParts }];

            const config: any = { systemInstruction };
            if (userInputText.toLowerCase().includes('cerca') || userInputText.toLowerCase().includes('comprar')) {
                config.tools = [{googleMaps: {}}];
                if(currentLocation) {
                    config.toolConfig = { retrievalConfig: { latLng: currentLocation } };
                }
            }

            const response = await ai.models.generateContent({
                model: model,
                contents,
                config,
            });

            const botResponse = response.text;
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

            setMessages(prev => [...prev, { 
                role: 'bot', 
                text: botResponse, 
                groundingChunks,
                id: Date.now() + 1
            }]);

        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'bot', text: 'Lo siento, ocurrió un error. Por favor, intenta de nuevo.', id: Date.now() + 1 }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const playAudio = async (text) => {
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
            }
        } catch (error) {
            console.error('Error generating speech:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`chat-modal ${isOpen ? 'open' : ''}`}>
            <div className="chat-header">
                <h3>Asistente Agrónomo</h3>
                <button onClick={onClose}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-content">
                            {msg.image && <img src={msg.image} alt="User upload" />}
                            {msg.text && <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} />}
                             {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="grounding-source">
                                    <strong>Fuentes:</strong>
                                    <ul>
                                        {msg.groundingChunks.map((chunk, index) => (
                                           (chunk.maps || chunk.web) && <li key={index}><a href={chunk.maps?.uri || chunk.web?.uri} target="_blank" rel="noopener noreferrer">{chunk.maps?.title || chunk.web?.title}</a></li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {msg.role === 'bot' && msg.text && (
                                <div className="message-actions">
                                   <button onClick={() => playAudio(msg.text)} title="Leer en voz alta">
                                        <span className="material-symbols-outlined">volume_up</span>
                                   </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                 {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="message bot">
                        <div className="message-content"><div className="spinner"></div></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input">
                <button onClick={() => fileInputRef.current.click()}><span className="material-symbols-outlined">attach_file</span></button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => setImage(e.target.files[0])} />
                <textarea 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={image ? "Describe la imagen..." : "Escribe tu pregunta..."}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                />
                <button onClick={handleSendMessage}><span className="material-symbols-outlined">send</span></button>
            </div>
        </div>
    );
};

const App = () => {
    const [activeTab, setActiveTab] = useState(herbicideData.crops[0].name);
    const [isChatOpen, setChatOpen] = useState(false);

    const renderContent = () => {
        const crop = herbicideData.crops.find(c => c.name === activeTab);
        if (!crop) {
          return <div>
            <h3>Leyenda (Grupos HRAC)</h3>
            {herbicideData.legend.map(item => (
                <p key={item.code}><strong>{item.code}</strong> = {item.desc}</p>
            ))}
          </div>
        }

        return (
            <div>
                <h2>{crop.name}</h2>
                {crop.stages.map((stage, index) => (
                    <div key={index} className="stage-accordion">
                        <details>
                            <summary>{stage.bbch} - {stage.title}</summary>
                            <div className="alternatives">
                                <div className="herbicide-card" dangerouslySetInnerHTML={{ __html: stage.content }} />
                            </div>
                        </details>
                    </div>
                ))}
                {crop.note && <div className="note">{crop.note}</div>}
            </div>
        );
    };

    return (
        <>
            <header>
                <h1>Guía de Herbicidas para Cereales</h1>
            </header>
            <main>
                <div className="tabs">
                    {herbicideData.crops.map(crop => (
                        <button key={crop.name} className={`tab ${activeTab === crop.name ? 'active' : ''}`} onClick={() => setActiveTab(crop.name)}>
                            {crop.name}
                        </button>
                    ))}
                    <button className={`tab ${activeTab === 'Leyenda' ? 'active' : ''}`} onClick={() => setActiveTab('Leyenda')}>
                        Leyenda
                    </button>
                </div>
                {renderContent()}
            </main>
            <button className="chat-fab" onClick={() => setChatOpen(true)} aria-label="Abrir chat de asistente">
                <span className="material-symbols-outlined">chat</span>
            </button>
            <ChatModal isOpen={isChatOpen} onClose={() => setChatOpen(false)} />
        </>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
