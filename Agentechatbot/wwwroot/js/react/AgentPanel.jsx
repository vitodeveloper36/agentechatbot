import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

function AgentPanel() {
  const [sessionId, setSessionId] = useState('');
  const [agentName, setAgentName] = useState('Agente');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
  const connectionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  const connect = async () => {
    if (!sessionId.trim() || status === 'connected') return;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/chathub')
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveMessage', (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    connection.onreconnecting(() => setStatus('connecting'));
    connection.onreconnected(() => setStatus('connected'));
    connection.onclose(() => setStatus('disconnected'));

    try {
      setStatus('connecting');
      await connection.start();
      await connection.invoke('RegisterAgent', sessionId);
      setStatus('connected');
      connectionRef.current = connection;
    } catch (err) {
      console.error('Error connecting to hub', err);
      setStatus('disconnected');
    }
  };

  const sendMessageHandler = async () => {
    if (!message.trim() || status !== 'connected') return;
    try {
      await connectionRef.current.invoke('AgentReply', sessionId, message, agentName);
      setMessages((prev) => [
        ...prev,
        { type: 'agent_message', message, agent: { name: agentName, avatar: '🧑‍💼' }, timestamp: new Date().toISOString() },
      ]);
      setMessage('');
    } catch (err) {
      console.error('Error sending message', err);
    }
  };

  const renderMessage = (msg, idx) => (
    <div key={idx} className={`flex ${msg.type === 'agent_message' ? 'justify-end' : ''}`}>
      <div className="flex space-x-2 max-w-md">
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-lg">
          {msg.agent?.avatar || '❔'}
        </div>
        <div>
          <div className="text-sm font-semibold">{msg.agent?.name}</div>
          <div className="bg-gray-100 rounded p-2 text-sm whitespace-pre-wrap">
            {msg.message}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
        <input
          className="border rounded px-2 py-1 flex-grow"
          placeholder="Session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 flex-grow"
          placeholder="Nombre del agente"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={connect}
          disabled={status === 'connected'}
        >
          Conectar
        </button>
        <span>
          {status === 'connected' ? '🟢 Conectado' : status === 'connecting' ? '🟡 Conectando...' : '🔴 Desconectado'}
        </span>
      </div>

      <div className="border rounded h-80 overflow-y-auto p-2 space-y-2 bg-white">
        {messages.map(renderMessage)}
      </div>

      <div className="flex space-x-2">
        <input
          className="border rounded flex-grow px-2 py-1"
          placeholder="Escribe un mensaje..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessageHandler(); } }}
        />
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={sendMessageHandler}>
          Enviar
        </button>
      </div>
    </div>
  );
}

export default AgentPanel;
