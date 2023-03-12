var version = "1.0";
var tabs = {};

import { Stats } from './stats.js';
import { StatsBuilder } from './stats.js';
import { HARBuilder } from './har.js';


// Set the correct Icon when switching tabs.
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.storage.local.get(['tabs'], function(result) {
    const tabs = result.tabs;
    if(tabs?.[activeInfo.tabId]) {
      chrome.action.setIcon({ path: "player_record.png" });
      chrome.action.setTitle({tabId: activeInfo.tabId, title: 'Click to stop record network requests.'});
    } else {
      chrome.action.setIcon({ path: "icons8-record-16.png" });
      chrome.action.setTitle({tabId: activeInfo.tabId, title: 'Click to start record network requests.'});
    }
  });
});

// Handle change of URL.
// In case the regex in `url_input` (saved from the settings) match the URL and we are not recording, we need to start.
// If it doesn't, and we already record it means that we were in an active session and we need to stop.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(!changeInfo.url) {
    return;
  }
  console.log(`tabId ${tabId}, changeInfo: ${changeInfo.url}`);
  chrome.storage.sync.get({url_input:''}, async function(result) {
    const url_input = result.url_input;
    // check if url_input is empty.
    // No need to record anything.
    if(!url_input) {
      return;
    }

    // check if url_input regex match with current tab url
    const regex = new RegExp(url_input);
    let match = true;
    if(!regex.test(changeInfo.url)) {
      match = false;
    }

    chrome.storage.local.get(['tabs'], async function(result) {
      let newTabs = result.tabs;
      if(newTabs?.[tab.id]) {
        if (!match) {
          stopRecordingTab(newTabs, tab);
        }
      } else {
        if (match) {
          startRecordingTab(newTabs, tab);
        }
      }
    });
  });
});

//Handle action clicked
chrome.action.onClicked.addListener(function(tab) {
  console.log("clicked");
  chrome.storage.local.get(['tabs'], async function(result) {
    let newTabs = result.tabs;
    if(newTabs?.[tab.id]) {
      stopRecordingTab(newTabs, tab);
    } else {
      startRecordingTab(newTabs, tab);
    }
  });
});


//TODO Remove async -   chrome.storage.local.get(['tabs'], async function(result) {
async function stopRecordingTab(newTabs, tab) {
  console.log('stopRecordingTab')
  chrome.debugger.detach({tabId:tab.id});
  chrome.action.setIcon({ path: "icons8-record-16.png" });
  chrome.action.setTitle({tabId: tab.id, title: 'Click to start record network requests.'});
  try{
    const fileName = new URL(tab.url).host;
    chrome.scripting.executeScript(
    {
      target: {tabId: tab.id},
      args: [encodeURIComponent(JSON.stringify(new HARBuilder().create([tabs[tab.id]], fileName))), `${fileName}.har`],
      function: generateHARFile,
    });
  } catch(error) {
    console.log(error);
  }
  newTabs[tab.id] = undefined;
  await writeTabObject(newTabs);
  console.log(`Action clicked: Tab ${tab.id} now unregistered.`);
}

async function startRecordingTab(newTabs, tab) {
  console.log('startRecordingTab')

  //initialize the prop
  if(!newTabs) {
    newTabs = {};
  }

  let stats = new Stats();
  tabs[tab.id] = stats;
  newTabs[tab.id] = stats;
  await writeTabObject(newTabs);

  chrome.action.setIcon({ path: "player_record.png" });
  chrome.action.setTitle({tabId: tab.id, title: 'Click to stop record network requests.'});
  chrome.debugger.attach({tabId:tab.id}, version, onAttach.bind(null, tab.id));
  chrome.debugger.sendCommand({tabId:tab.id}, "Network.enable");

  chrome.debugger.onEvent.addListener(async (debuggeeId, method, params) => {

    StatsBuilder.processEvent(stats, {method, params});
    tabs[tab.id] = {"stats": stats, "title": URL(tab.url).host};
    if(method === "Network.loadingFinished") {
      chrome.debugger.sendCommand({ tabId: tab.id }, "Network.getResponseBody", { requestId: params.requestId }, (responseBodyParams) => {
          if(responseBodyParams){
            const {body, base64Encoded} = responseBodyParams;
            StatsBuilder.processEvent(stats, {method: 'Network.getResponseBody', params: {
              requestId: params.requestId,
              body,
              base64Encoded
            }});
            }
      });
    }
  });
}


function generateHARFile(encodedString, fileName) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:application/json,' + encodedString);
  element.setAttribute('download', fileName);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}


function onAttach(tabId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }
}


function writeTabObject(tabs) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ tabs }, function(result) {
      resolve(tabs);
    });
 });
}
