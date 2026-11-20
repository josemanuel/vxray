// ------------------------------ settings ------------------------------
const DEFAULTS = { skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
                   style: "xray", bright: 1, real: 0.12, feather: 0.2, reveal: "whole", cut: 0.5, showdata: false,
                   fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false };
let S = Object.assign({}, DEFAULTS);
try { Object.assign(S, JSON.parse(localStorage.getItem("xr_settings") || "{}")); } catch (e) {}
function save() { try { localStorage.setItem("xr_settings", JSON.stringify(S)); } catch (e) {} }
const LAYERS = ["skull", "brain", "muscles", "eyes", "outline", "hands"];
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz"];

function syncUI() {
  for (const k of LAYERS) $("L_" + k).checked = S[k];
  for (const b of $("style").children) b.classList.toggle("on", b.dataset.style === S.style);
  for (const k of SLIDERS) $(k).value = S[k];
  for (const k of ["fs", "fw", "fh", "fd"]) $(k + "v").textContent = Math.round(S[k] * 100) + "%";
  for (const k of ["fx", "fy", "fz"]) $(k + "v").textContent = (S[k] > 0 ? "+" : "") + S[k].toFixed(1) + " cm";
  $("featherv").textContent = Math.round(S.feather * 100) + "%";
  $("labels").checked = S.labels;
  $("reveal").value = S.reveal; $("showdata").checked = S.showdata; $("data").hidden = !S.showdata;
  $("cutrow").hidden = S.reveal === "whole";
  $("cutlabel").textContent = S.reveal === "lens" ? "Tamaño de la lente" : "Posición del corte";
}
for (const k of LAYERS) $("L_" + k).onchange = e => { S[k] = e.target.checked; save(); };
for (const b of $("style").children) b.onclick = () => { S.style = b.dataset.style; save(); syncUI(); applyStyle(); };
for (const k of SLIDERS) $(k).oninput = e => { S[k] = parseFloat(e.target.value); save(); syncUI(); };
$("labels").onchange = e => { S.labels = e.target.checked; save(); };
$("reveal").onchange = e => { S.reveal = e.target.value; S.cut = 0.5; save(); syncUI(); };
$("showdata").onchange = e => { S.showdata = e.target.checked; save(); syncUI(); };
$("fitreset").onclick = () => { S.fs = S.fw = S.fh = S.fd = 1; S.fx = S.fy = S.fz = 0; save(); syncUI(); };
for (const b of document.querySelectorAll("[data-preset]")) b.onclick = () => {
  const p = b.dataset.preset;
  S.skull = p === "skull" || p === "all"; S.brain = p === "brain" || p === "all";
  S.muscles = p === "muscles" || p === "all"; S.eyes = p !== "brain"; S.outline = true;
  save(); syncUI();
};
syncUI();

