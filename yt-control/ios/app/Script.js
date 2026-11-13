// Връзка с ViewController.swift: webkit.messageHandlers.controller.postMessage(...)
function post(msg) {
  try { webkit.messageHandlers.controller.postMessage(msg); } catch (e) { /* в браузър за преглед */ }
}
// Извиква се от Swift при старт: show(autoOpen)
function show(autoOpen) {
  var cb = document.getElementById('autoOpen');
  cb.checked = !!autoOpen;
  if (autoOpen) {
    var auto = document.getElementById('auto');
    auto.classList.remove('hide');
    var stay = false;
    auto.addEventListener('click', function () { stay = true; auto.classList.add('hide'); });
    setTimeout(function () { if (!stay) { auto.classList.add('hide'); post('open-youtube'); } }, 1200);
  }
}
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('open').addEventListener('click', function () { post('open-youtube'); });
  document.getElementById('autoOpen').addEventListener('change', function (e) { post(e.target.checked ? 'auto-on' : 'auto-off'); });
});
