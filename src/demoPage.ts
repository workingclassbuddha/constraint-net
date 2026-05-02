export function renderDemoPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Constraint Net</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17202a;
        --muted: #647083;
        --line: #d9e0e7;
        --paper: #fbfbf8;
        --panel: #ffffff;
        --blue: #2563eb;
        --green: #16825d;
        --red: #b42318;
        --amber: #9a6700;
        --violet: #6d28d9;
        --shadow: 0 18px 44px rgba(18, 28, 45, 0.10);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(120deg, rgba(37, 99, 235, 0.08), transparent 34%),
          linear-gradient(230deg, rgba(22, 130, 93, 0.09), transparent 38%),
          var(--paper);
        color: var(--ink);
      }

      button,
      textarea {
        font: inherit;
      }

      .shell {
        width: min(1440px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 22px 0 28px;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 10px 0 18px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .mark {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        color: white;
        background: conic-gradient(from 220deg, var(--blue), var(--green), var(--violet), var(--blue));
        font-weight: 760;
      }

      h1 {
        margin: 0;
        font-size: clamp(1.35rem, 2.4vw, 2.1rem);
        line-height: 1.02;
        letter-spacing: 0;
      }

      .statusline {
        color: var(--muted);
        font-size: 0.88rem;
        margin-top: 3px;
      }

      .health {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.68);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 0.84rem;
        color: var(--muted);
        white-space: nowrap;
      }

      .dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: var(--green);
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(270px, 0.9fr) minmax(360px, 1.35fr) minmax(300px, 1fr);
        gap: 16px;
        align-items: stretch;
      }

      .panel {
        background: rgba(255,255,255,0.88);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        min-width: 0;
      }

      .panel-head {
        padding: 16px 16px 12px;
        border-bottom: 1px solid var(--line);
      }

      .panel-title {
        margin: 0;
        font-size: 0.93rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #2d3748;
      }

      .panel-body {
        padding: 16px;
      }

      textarea {
        width: 100%;
        min-height: 112px;
        resize: vertical;
        border: 1px solid #cbd5df;
        border-radius: 8px;
        padding: 12px;
        color: var(--ink);
        background: white;
        line-height: 1.45;
      }

      textarea:focus,
      button:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.24);
        outline-offset: 2px;
      }

      .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.2;
      }

      input {
        min-width: 0;
        width: 100%;
        border: 1px solid #cbd5df;
        border-radius: 8px;
        padding: 9px 10px;
        color: var(--ink);
        font: inherit;
      }

      .primary {
        width: 100%;
        margin-top: 14px;
        border: 0;
        border-radius: 8px;
        padding: 12px 14px;
        background: var(--blue);
        color: white;
        font-weight: 720;
        cursor: pointer;
      }

      .secondary {
        border: 1px solid #c7d2df;
        border-radius: 8px;
        padding: 10px 12px;
        background: white;
        color: var(--ink);
        font-weight: 680;
        cursor: pointer;
      }

      .secondary:disabled,
      .primary:disabled {
        opacity: 0.48;
        cursor: not-allowed;
      }

      .metric-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 16px;
      }

      .metric {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
        background: #fbfdff;
      }

      .metric strong {
        display: block;
        font-size: 1.3rem;
        line-height: 1;
      }

      .metric span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 0.76rem;
      }

      .field {
        position: relative;
        min-height: 360px;
        border: 1px solid #d7dee8;
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(23,32,42,0.05) 1px, transparent 1px),
          linear-gradient(rgba(23,32,42,0.05) 1px, transparent 1px),
          linear-gradient(145deg, #f8fbff, #f7fff9);
        background-size: 34px 34px, 34px 34px, 100% 100%;
        overflow: hidden;
      }

      .node {
        position: absolute;
        border: 1px solid rgba(23,32,42,0.14);
        border-radius: 8px;
        padding: 10px;
        width: 150px;
        background: rgba(255,255,255,0.92);
        box-shadow: 0 10px 22px rgba(18, 28, 45, 0.08);
      }

      .node small {
        color: var(--muted);
        display: block;
        font-size: 0.72rem;
      }

      .node strong {
        display: block;
        margin-top: 3px;
        font-size: 0.9rem;
      }

      .node.intent { left: 22px; top: 22px; border-color: rgba(37, 99, 235, 0.35); }
      .node.policy { right: 22px; top: 28px; border-color: rgba(109, 40, 217, 0.35); }
      .node.schema { left: 32px; bottom: 28px; border-color: rgba(22, 130, 93, 0.35); }
      .node.trust { right: 32px; bottom: 30px; border-color: rgba(154, 103, 0, 0.35); }

      .path {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: grid;
        gap: 10px;
        width: min(250px, 46%);
      }

      .step {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border: 1px solid #17202a;
        border-radius: 8px;
        background: #17202a;
        color: white;
        padding: 10px 12px;
        font-size: 0.88rem;
      }

      .step span {
        color: #cbd5e1;
        font-size: 0.72rem;
        white-space: nowrap;
      }

      .why {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .why div,
      .receipt {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: white;
        padding: 9px 10px;
        font-size: 0.86rem;
        color: #344054;
      }

      .flow-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .confirmation {
        margin-top: 14px;
        border: 1px solid #cbd5df;
        border-radius: 8px;
        background: #fbfdff;
        padding: 12px;
      }

      .confirmation dl {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 8px 10px;
        margin: 0;
        font-size: 0.86rem;
      }

      .confirmation dt {
        color: var(--muted);
      }

      .confirmation dd {
        margin: 0;
      }

      .result {
        margin-top: 14px;
        border-left: 4px solid var(--green);
        background: #f2fbf6;
        padding: 12px;
        border-radius: 8px;
        font-size: 0.88rem;
      }

      .receipts {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .receipt {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .receipt code {
        color: var(--muted);
        font-size: 0.76rem;
        word-break: break-all;
      }

      .log {
        margin-top: 14px;
        min-height: 42px;
        color: var(--muted);
        font-size: 0.84rem;
        line-height: 1.45;
      }

      @media (max-width: 980px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .field {
          min-height: 410px;
        }
      }

      @media (max-width: 560px) {
        .shell {
          width: min(100vw - 20px, 1440px);
          padding-top: 12px;
        }

        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .health {
          white-space: normal;
        }

        .field-grid,
        .metric-row {
          grid-template-columns: 1fr;
        }

        .node {
          width: 132px;
          font-size: 0.82rem;
        }

        .path {
          width: 72%;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="mark">CN</div>
          <div>
            <h1>Constraint Net</h1>
            <div class="statusline">Coherence-first execution for reversible customer-service actions</div>
          </div>
        </div>
        <div class="health"><span class="dot"></span><span>Local MVP connected to in-memory SoundMart manifest</span></div>
      </header>

      <section class="grid">
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Intent</h2>
          </div>
          <div class="panel-body">
            <textarea id="goal">Return my headphones from SoundMart and choose the fastest free pickup</textarea>
            <div class="field-grid">
              <label>Merchant <input id="merchant" value="soundmart.example" /></label>
              <label>Order <input id="orderId" value="ord_123" /></label>
              <label>Item <input id="itemId" value="item_headphones" /></label>
              <label>Reason <input id="reason" value="changed_mind" /></label>
            </div>
            <button id="searchBtn" class="primary">Run coherence search</button>
            <div class="metric-row">
              <div class="metric"><strong id="score">--</strong><span>coherence</span></div>
              <div class="metric"><strong id="risk">--</strong><span>max tier</span></div>
              <div class="metric"><strong id="steps">--</strong><span>steps</span></div>
            </div>
            <div id="log" class="log">Ready.</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Coherence field</h2>
          </div>
          <div class="panel-body">
            <div class="field">
              <div class="node intent"><small>Attractor</small><strong>Intent fit</strong></div>
              <div class="node policy"><small>Hard gate</small><strong>Policy</strong></div>
              <div class="node schema"><small>Stabilizer</small><strong>Schema</strong></div>
              <div class="node trust"><small>Stabilizer</small><strong>Trust</strong></div>
              <div id="path" class="path">
                <div class="step">Waiting <span>search</span></div>
              </div>
            </div>
            <div id="why" class="why"></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Execution rail</h2>
          </div>
          <div class="panel-body">
            <div class="flow-actions">
              <button id="preflightBtn" class="secondary" disabled>Preflight return</button>
              <button id="confirmBtn" class="secondary" disabled>Confirm</button>
              <button id="executeBtn" class="secondary" disabled>Execute</button>
            </div>

            <div id="confirmation" class="confirmation" hidden></div>
            <div id="result" class="result" hidden></div>
            <div id="receipts" class="receipts"></div>
          </div>
        </section>
      </section>
    </main>

    <script>
      const state = {
        returnStep: null,
        preflight: null,
        confirmation: null
      };

      const els = {
        goal: document.getElementById("goal"),
        merchant: document.getElementById("merchant"),
        orderId: document.getElementById("orderId"),
        itemId: document.getElementById("itemId"),
        reason: document.getElementById("reason"),
        searchBtn: document.getElementById("searchBtn"),
        preflightBtn: document.getElementById("preflightBtn"),
        confirmBtn: document.getElementById("confirmBtn"),
        executeBtn: document.getElementById("executeBtn"),
        path: document.getElementById("path"),
        why: document.getElementById("why"),
        score: document.getElementById("score"),
        risk: document.getElementById("risk"),
        steps: document.getElementById("steps"),
        log: document.getElementById("log"),
        confirmation: document.getElementById("confirmation"),
        result: document.getElementById("result"),
        receipts: document.getElementById("receipts")
      };

      function setLog(message) {
        els.log.textContent = message;
      }

      async function postJson(url, payload) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.status || response.statusText);
        return body;
      }

      function renderPath(path) {
        els.path.innerHTML = path.steps
          .map((step, index) => '<div class="step">' + step + '<span>' + (index + 1) + '</span></div>')
          .join("");
        els.why.innerHTML = path.why_coherent.map((text) => "<div>" + text + "</div>").join("");
        els.score.textContent = Math.round(path.coherence_score * 100) + "%";
        els.risk.textContent = Math.max(...path.step_details.map((step) => step.risk_tier));
        els.steps.textContent = path.steps.length;
      }

      function renderConfirmation(confirmation) {
        els.confirmation.hidden = false;
        els.confirmation.innerHTML =
          "<dl>" +
          "<dt>Action</dt><dd>" + confirmation.summary.action_path.join(" -> ") + "</dd>" +
          "<dt>Merchant</dt><dd>" + confirmation.summary.merchant + "</dd>" +
          "<dt>Data</dt><dd>" + confirmation.summary.data_shared.join(", ") + "</dd>" +
          "<dt>Reversible</dt><dd>" + (confirmation.summary.reversible ? "yes" : "no") + "</dd>" +
          "</dl>";
      }

      els.searchBtn.addEventListener("click", async () => {
        setLog("Resolving coherence path...");
        els.result.hidden = true;
        els.receipts.innerHTML = "";
        const body = await postJson("/v1/actions/search", {
          goal: els.goal.value,
          constraints: {
            merchant: els.merchant.value,
            risk_tiers_allowed: [0, 1, 2],
            requires_reversible: true
          }
        });
        const path = body.paths[0];
        renderPath(path);
        state.returnStep = path.step_details.find((step) => step.stable_id === "return.create");
        els.preflightBtn.disabled = !state.returnStep;
        els.confirmBtn.disabled = true;
        els.executeBtn.disabled = true;
        setLog("Coherent path found.");
      });

      els.preflightBtn.addEventListener("click", async () => {
        setLog("Preflighting Tier 2 return action...");
        const body = await postJson("/v1/executions/preflight", {
          action_id: state.returnStep.action_id,
          manifest_digest: state.returnStep.manifest_digest,
          inputs: {
            order_id: els.orderId.value,
            item_id: els.itemId.value,
            reason: els.reason.value
          }
        });
        state.preflight = body;
        state.confirmation = body.confirmation;
        renderConfirmation(body.confirmation);
        els.confirmBtn.disabled = false;
        els.executeBtn.disabled = true;
        setLog("Confirmation required before execution.");
      });

      els.confirmBtn.addEventListener("click", async () => {
        setLog("Recording consent receipt...");
        const confirmation = await postJson("/v1/confirmations/" + state.confirmation.id + "/decision", {
          decision: "confirm"
        });
        state.confirmation = confirmation;
        els.executeBtn.disabled = false;
        setLog("Confirmed. Execution rail is armed.");
      });

      els.executeBtn.addEventListener("click", async () => {
        setLog("Executing pinned OpenAPI action...");
        const body = await postJson("/v1/executions", {
          preflight_id: state.preflight.preflight_id,
          confirmation_id: state.confirmation.id,
          idempotency_key: "ui_" + Date.now()
        });
        els.result.hidden = false;
        els.result.textContent = "Return created: " + body.result.return_id + " | refund $" + body.result.refund_amount;
        els.receipts.innerHTML = body.receipts
          .map((receipt) => '<div class="receipt"><strong>' + receipt.type + '</strong><code>' + receipt.receipt_id + '</code></div>')
          .join("");
        setLog("Execution complete. Receipts signed.");
      });
    </script>
  </body>
</html>`;
}
