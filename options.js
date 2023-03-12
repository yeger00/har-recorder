// Saves options to chrome.storage
function save_options() {
  var url_input = document.getElementById('url_input').value;
  chrome.storage.sync.set({
    url_input: url_input,
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value url_input = '', i.e. don't monitor anything
  chrome.storage.sync.get({
	  url_input: '',
  }, function(items) {
    document.getElementById('url_input').value = items.url_input;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);
