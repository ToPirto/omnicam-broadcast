import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsBridge } from '../src/obs.js';

describe('ObsBridge', () => {
  let bridge;
  let signalingMock;
  let registryMock;

  beforeEach(() => {
    registryMock = {
      listCameras: vi.fn().mockReturnValue([{ id: 'cam-123' }, { id: 'cam-456' }]),
      updateTally: vi.fn(),
    };
    signalingMock = {
      registry: registryMock,
      relayTo: vi.fn(),
      broadcastToDashboards: vi.fn(),
    };

    bridge = new ObsBridge({}, signalingMock);
    bridge.connected = true;
    
    // Mock the OBS WebSocket methods
    bridge.obs.call = vi.fn();
    
    // Default mock implementation
    bridge.obs.call.mockImplementation(async (requestType, requestData) => {
      if (requestType === 'GetInputList') {
        return { inputs: [{ inputName: 'My Camera Source', inputKind: 'browser_source' }] };
      }
      if (requestType === 'GetInputSettings') {
        return { inputSettings: { url: 'https://127.0.0.1:3000/view/index.html?camId=cam-123' } };
      }
      if (requestType === 'GetCurrentProgramScene') {
        return { currentProgramSceneName: 'Scene 1' };
      }
      if (requestType === 'GetCurrentPreviewScene') {
        return { currentPreviewSceneName: 'Scene 2' };
      }
      if (requestType === 'GetSceneItemList') {
        if (requestData.sceneName === 'Scene 1') {
          // Normal mode, camera in program
          return {
            sceneItems: [
              { sceneItemEnabled: true, sourceType: 'OBS_SOURCE_TYPE_INPUT', sourceName: 'My Camera Source' }
            ]
          };
        }
        if (requestData.sceneName === 'Scene 2') {
          // Camera not in preview
          return { sceneItems: [] };
        }
        return { sceneItems: [] };
      }
      return {};
    });
  });

  it('should map input URL to camId', async () => {
    await bridge.refreshInputs();
    expect(bridge.inputToCamId.get('My Camera Source')).toBe('cam-123');
  });

  it('should resolve tally to Program (2) when in Program scene', async () => {
    await bridge.updateTally();
    expect(bridge.tallyState.get('cam-123')).toBe(2);
    expect(signalingMock.registry.updateTally).toHaveBeenCalledWith('cam-123', 2);
  });

  it('should resolve tally to Preview (1) when in Preview scene only (Studio Mode)', async () => {
    bridge.obs.call.mockImplementation(async (req, data) => {
      if (req === 'GetInputList') return { inputs: [{ inputName: 'My Camera Source', inputKind: 'browser_source' }] };
      if (req === 'GetInputSettings') return { inputSettings: { url: '/view/cam-123' } };
      if (req === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Live Scene' };
      if (req === 'GetCurrentPreviewScene') return { currentPreviewSceneName: 'Next Scene' };
      if (req === 'GetSceneItemList') {
        if (data.sceneName === 'Live Scene') return { sceneItems: [] };
        if (data.sceneName === 'Next Scene') return {
          sceneItems: [{ sceneItemEnabled: true, sourceType: 'OBS_SOURCE_TYPE_INPUT', sourceName: 'My Camera Source' }]
        };
      }
      return {};
    });

    await bridge.updateTally();
    expect(bridge.tallyState.get('cam-123')).toBe(1);
  });

  it('should resolve tally to Off (0) when not in active scenes', async () => {
    bridge.obs.call.mockImplementation(async (req, data) => {
      if (req === 'GetInputList') return { inputs: [{ inputName: 'My Camera Source', inputKind: 'browser_source' }] };
      if (req === 'GetInputSettings') return { inputSettings: { url: '/view/cam-123' } };
      if (req === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Live Scene' };
      if (req === 'GetCurrentPreviewScene') return { currentPreviewSceneName: 'Next Scene' };
      if (req === 'GetSceneItemList') return { sceneItems: [] };
      return {};
    });

    await bridge.updateTally();
    expect(bridge.tallyState.get('cam-123')).toBe(0);
  });

  it('should handle nested scenes/groups correctly', async () => {
    bridge.obs.call.mockImplementation(async (req, data) => {
      if (req === 'GetInputList') return { inputs: [{ inputName: 'My Camera Source', inputKind: 'browser_source' }] };
      if (req === 'GetInputSettings') return { inputSettings: { url: '/view/cam-123' } };
      if (req === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Main Scene' };
      if (req === 'GetCurrentPreviewScene') throw new Error('Not in studio mode'); // Normal mode
      if (req === 'GetSceneItemList') {
        if (data.sceneName === 'Main Scene') {
          return {
            sceneItems: [
              { sceneItemEnabled: true, sourceType: 'OBS_SOURCE_TYPE_SCENE', sourceName: 'Nested Scene' }
            ]
          };
        }
        if (data.sceneName === 'Nested Scene') {
          return {
            sceneItems: [
              { sceneItemEnabled: true, sourceType: 'OBS_SOURCE_TYPE_INPUT', sourceName: 'My Camera Source' }
            ]
          };
        }
      }
      return {};
    });

    await bridge.updateTally();
    expect(bridge.tallyState.get('cam-123')).toBe(2);
  });
  
  it('should not give tally if scene item is disabled', async () => {
    bridge.obs.call.mockImplementation(async (req, data) => {
      if (req === 'GetInputList') return { inputs: [{ inputName: 'My Camera Source', inputKind: 'browser_source' }] };
      if (req === 'GetInputSettings') return { inputSettings: { url: '/view/cam-123' } };
      if (req === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Main Scene' };
      if (req === 'GetSceneItemList') {
        if (data.sceneName === 'Main Scene') {
          return {
            sceneItems: [
              { sceneItemEnabled: false, sourceType: 'OBS_SOURCE_TYPE_INPUT', sourceName: 'My Camera Source' }
            ]
          };
        }
      }
      return {};
    });

    await bridge.updateTally();
    expect(bridge.tallyState.get('cam-123')).toBe(0);
  });
});
