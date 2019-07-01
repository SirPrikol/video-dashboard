import Vuex from 'vuex';
import Vue from 'vue';
import moment from 'moment';
// use sockjs as websocket "polyfill" for shared hosting
import SockJS from 'sockjs-client';
import createPersistedState from 'vuex-persistedstate';


const CURRENT_TIME_UPDATE_INTERVAL = 10000; // ms
const DEFAULT_SETTINGS = {
  fontSize: 18
};
const MAX_MESSAGE_COUNT = 50;
const SETTINGS_STORAGE_KEY = 'videoDashboardSettings';

Vue.use(Vuex);

function modifyCamera (cameras, uuid, fn) {
  if (!cameras) {
    return;
  }
  for (const camera of cameras) {
    if (camera.uuid === uuid) {
      fn(camera);
      return camera;
    }
  }
}

function readSettings () {
  const storageString = localStorage.getItem(SETTINGS_STORAGE_KEY);
  return storageString ? JSON.parse(storageString) : null;
}

function setMomentTimeCorrection (correctTimestamp) {
  const offset = correctTimestamp - Date.now();
  moment.now = () => Date.now() + offset;
}

export function createStore () {
  return new Vuex.Store({
    actions: {
      initialize ({ commit, dispatch }) {
        return new Promise((resolve, reject) => {
          const socket = new SockJS(`/events`);
          socket.onopen = async () => {
            try {
              await dispatch('loadCameras');
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          socket.onerror = reject;
          socket.onclose = () => {
            commit('setConnectionStatus', false);
            setTimeout(() => dispatch('initialize'), 2000);
          };
          socket.onmessage = message => {
            dispatch('processSocketMessage', JSON.parse(message.data));
          };
        });
      },

      async loadCameras ({ commit }) {
        const response = await fetch('/cameras', {
          credentials: 'include',
          mode: 'cors'
        });
        const cameras = await response.json();
        commit('setCameras', cameras.map(camera => ({
          ...camera,
          lastUpdated: camera.lastUpdated && moment.unix(camera.lastUpdated / 1000)
        })));
        commit('forceUpdateAllCameras');
        commit('setConnectionStatus', true);
      },

      processSocketMessage ({ commit }, message) {
        switch (message.type) {
          case 'update':
            commit('updateCamera', {
              failureCounter: message.failureCounter,
              time: moment.unix(message.time / 1000),
              uuid: message.uuid
            });
            break;
          case 'loading':
            commit('setLoadingStatus', {
              uuid: message.uuid,
              value: message.value
            });
            break;
          case 'time':
            setMomentTimeCorrection(message.value);
            commit('setCurrentTime', moment());
            break;
          case 'error':
            commit('setCameraError', {
              error: message.message,
              failureCounter: message.failureCounter,
              time: moment.unix(message.time / 1000),
              uuid: message.uuid
            });
            break;
          case 'poweredOff':
            commit('setPoweredOff', {
              uuid: message.uuid,
              value: message.poweredOff
            });
            break;
        }
      },

      setupTimeUpdater ({ commit }) {
        setInterval(() => {
          commit('setCurrentTime', moment());
        }, CURRENT_TIME_UPDATE_INTERVAL);
      },

      async toggleCameraPoweredOff ({ commit }, camera) {
        commit('toggleCameraPoweredOff', camera.uuid);
        await fetch('/cameras/' + camera.uuid + '/poweredOff', {
          body: JSON.stringify({ value: camera.isPoweredOff }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          mode: 'cors'
        });
      }
    },
    getters: {
      unreadMessagesCount (state) {
        return state.messages.filter(m => m.unread).length;
      }
    },
    mutations: {
      forceUpdateAllCameras (state) {
        state.maxImageVersion++;
        for (const camera of state.cameras) {
          camera.imageVersion = state.maxImageVersion;
        }
      },
      setCameraError (state, { error, failureCounter, time, uuid }) {
        const camera = modifyCamera(state.cameras, uuid, camera => {
          camera.error = error;
          camera.failureCounter = failureCounter;
          camera.lastUpdated = time;
        });
        if (camera && !camera.isPoweredOff) {
          state.messages.push({
            camera,
            message: error,
            time,
            unread: true
          });
          if (state.messages.length > MAX_MESSAGE_COUNT) {
            state.messages = state.messages.slice(-MAX_MESSAGE_COUNT);
          }
        }
      },
      setCameras (state, cameras) {
        state.cameras = cameras;
      },
      setConnectionStatus (state, status) {
        state.connectionLost = !status;
      },
      setCurrentTime (state, time) {
        state.currentTime = time;
      },
      setFontSize (state, fontSize) {
        state.settings.fontSize = fontSize;
      },
      setLoadingStatus (state, { uuid, value }) {
        modifyCamera(state.cameras, uuid, camera => camera.loading = value);
      },
      setPoweredOff(state, { uuid, value }) {
        modifyCamera(state, uuid, camera => {
          camera.isPoweredOff = value;
        });
      },
      toggleCameraPoweredOff (state, uuid) {
        modifyCamera(state.cameras, uuid,
          camera => camera.isPoweredOff = !camera.isPoweredOff
        );
      },
      updateCamera (state, { failureCounter, time, uuid }) {
        const camera = modifyCamera(state.cameras, uuid, camera => {
          camera.error = false;
          camera.failureCounter = failureCounter;
          camera.imageVersion++;
          camera.lastUpdated = time;
        });
        if (camera) {
          state.maxImageVersion = Math.max(state.maxImageVersion, camera.imageVersion);
        }
      }
    },
    plugins: [createPersistedState({
      key: 'settings',
      paths: ['settings']
    })],
    state: {
      cameras: null,
      connectionLost: false,
      currentTime: moment(),
      maxImageVersion: 0,
      messages: [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(readSettings() || {})
      },
      showLogs: false
    }
  });
}