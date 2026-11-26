// The only bridge between the window and the main process. The window gets a small,
// fixed set of functions; it never receives ipcRenderer, Node or Electron objects.
const { contextBridge, ipcRenderer } = require('electron');

const listen = channel => handler => {
  const fn = (_event, data) => handler(data);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  info: () => ipcRenderer.invoke('app:info'),
  status: () => ipcRenderer.invoke('broker:status'),
  suggestPassword: () => ipcRenderer.invoke('broker:suggest'),
  setup: password => ipcRenderer.invoke('broker:setup', password),
  revealPassword: () => ipcRenderer.invoke('broker:reveal'),
  restart: () => ipcRenderer.invoke('broker:restart'),
  replayRetained: () => ipcRenderer.invoke('mqtt:replay'),
  publish: (topic, payload) => ipcRenderer.invoke('mqtt:publish', { topic, payload }),
  copy: text => ipcRenderer.invoke('clipboard:write', text),
  models: () => ipcRenderer.invoke('models:list'),
  ask: (model, prompt, opts = {}) => ipcRenderer.invoke('models:ask', { model, prompt, system: opts.system, maxTokens: opts.maxTokens }),
  setModelServer: url => ipcRenderer.invoke('models:url', url),
  look: (model, prompt, camera, opts = {}) => ipcRenderer.invoke('models:look', { model, prompt, camera, system: opts.system, maxTokens: opts.maxTokens }),
  remote: () => ipcRenderer.invoke('link:status'),
  setRemote: (url, token) => ipcRenderer.invoke('link:set', { url, token }),
  onMessage: listen('mqtt:message'),
  onBroker: listen('broker:state'),
  onRemote: listen('link:state'),
}));
