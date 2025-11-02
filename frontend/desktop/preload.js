const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('voipDesktop', {
  notify: (title, body) => {
    new Notification({ title, body }).show();
  }
});


