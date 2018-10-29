import Vue from 'vue';
import App from './App';
import ReconnectingWebSocket from 'reconnecting-websocket';
import throttle from 'lodash/throttle';

Vue.config.productionTip = false;

const DEFAULT_SETTINGS = {
  fontSize: 10
};
const SETTINGS_MIN_WRITE_INTERVAL = 1000;
const SETTINGS_STORAGE_KEY = 'videoDashboardSettings';

function readSettings () {
  const storageString = localStorage.getItem(SETTINGS_STORAGE_KEY);
  return storageString ? JSON.parse(storageString) : null;
}

function writeSettings (value) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
}

async function main () {
  const app = new Vue({
    el: '#app',
    components: { App },
    data: {
      cameras: null,
      connectionLost: false,
      maxImageVersion: 0,
      messages: [],
      settings: readSettings() || DEFAULT_SETTINGS,
      showLogs: false
    },
    methods: {
      processMessage (message) {
        if (message.type === 'update') {
          this.modifyCamera(message.uuid, camera => {
            camera.error = false;
            camera.imageVersion++;
            this.maxImageVersion = Math.max(this.maxImageVersion, camera.imageVersion);
          });
        } else if (message.type === 'loading') {
          this.modifyCamera(message.uuid, camera => camera.loading = message.value);
        } else {
          const camera = this.modifyCamera(
            message.uuid, camera => camera.error = message.message
          );
          if (!camera) {
            return;
          }
          this.messages.push({
            ...message, camera,
            unread: true
          });
          if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
          }
        }
      },
      modifyCamera (uuid, fn) {
        if (!this.cameras) {
          return;
        }
        for (const camera of this.cameras) {
          if (camera.uuid === uuid) {
            fn(camera);
            return camera;
          }
        }
      }
    },
    created () {
      this.$watch('settings', throttle(() => {
        writeSettings(this.settings);
      }, SETTINGS_MIN_WRITE_INTERVAL), { deep: true });
    },
    template: `
      <App
        :cameras='cameras' :messages='messages'
        :connectionLost='connectionLost' :settings='settings'
      />
    `
  });

  try {
    const socket = new ReconnectingWebSocket(`ws://${location.host}/events`);
    socket.onopen = async () => {
      const response = await fetch('/cameras');
      const cameras = await response.json();
      app.cameras = cameras.map(camera => ({
        ...camera,
        imageVersion: app.maxImageVersion + 1
      }));
      app.connectionLost = false;
    };
    socket.onclose = () => {
      app.connectionLost = true;
    };
    socket.onmessage = message => {
      app.processMessage(JSON.parse(message.data));
    };
  } catch (error) {
    alert('Не удалось инициализировать приложение. См. консоль браузера.');
    console.error(error);
  }
}

main();
