/**
 * WebCheck Test Suite — Behavioral Logic for 15 Verification Scenarios
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Working Button
  let counter = 0;
  const btnWorking = document.getElementById('btnWorking');
  const counterVal = document.getElementById('counterVal');
  btnWorking.addEventListener('click', () => {
    counter++;
    counterVal.textContent = counter;
  });

  // 2. Throws JavaScript Exception
  const btnThrowError = document.getElementById('btnThrowError');
  btnThrowError.addEventListener('click', () => {
    throw new Error('CRITICAL_SYNTHETIC_EXCEPTION: Simulated unhandled click handler exception');
  });

  // 3. No Observable Result
  const btnNoOp = document.getElementById('btnNoOp');
  btnNoOp.addEventListener('click', () => {
    // Deliberately empty callback: no DOM change, no state change, no route change
    void(0);
  });

  // 4. Modal / Dialog Toggle
  const btnOpenModal = document.getElementById('btnOpenModal');
  const testModal = document.getElementById('testModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  btnOpenModal.addEventListener('click', () => {
    if (typeof testModal.showModal === 'function') {
      testModal.showModal();
    } else {
      testModal.setAttribute('open', '');
    }
  });
  btnCloseModal.addEventListener('click', () => {
    if (typeof testModal.close === 'function') {
      testModal.close();
    } else {
      testModal.removeAttribute('open');
    }
  });

  // 10. Simulated Failed API Request (500)
  const btnFetchFail = document.getElementById('btnFetchFail');
  const fetchStatusText = document.getElementById('fetchStatusText');
  btnFetchFail.addEventListener('click', async () => {
    fetchStatusText.textContent = 'Calling /api/broken-endpoint...';
    try {
      // In local static server, /api/broken-endpoint returns 404 or simulated 500
      const res = await fetch('/api/broken-endpoint');
      fetchStatusText.textContent = `Server responded: HTTP ${res.status}`;
    } catch (err) {
      fetchStatusText.textContent = `Fetch error: ${err.message}`;
    }
  });

  // 11. Delayed Response
  const btnDelayed = document.getElementById('btnDelayed');
  const spinnerElement = document.getElementById('spinnerElement');
  btnDelayed.addEventListener('click', () => {
    spinnerElement.style.display = 'inline-block';
    btnDelayed.disabled = true;
    setTimeout(() => {
      spinnerElement.style.display = 'none';
      btnDelayed.disabled = false;
      btnDelayed.textContent = 'Operation Completed!';
    }, 1200);
  });

  // 12. Dynamically Rendered Element
  const btnRenderDynamic = document.getElementById('btnRenderDynamic');
  const dynamicContainer = document.getElementById('dynamicContainer');
  let dynamicCount = 0;
  btnRenderDynamic.addEventListener('click', () => {
    dynamicCount++;
    const card = document.createElement('div');
    card.style.marginTop = '6px';
    card.style.padding = '6px';
    card.style.background = '#0f172a';
    card.style.borderRadius = '4px';
    card.style.border = '1px solid #38bdf8';
    card.innerHTML = `<span style="font-size: 11px; color: #38bdf8;">Dynamic Card #${dynamicCount} generated at ${new Date().toLocaleTimeString()}</span>`;
    dynamicContainer.appendChild(card);
  });

  // 13. SPA Route Navigation
  const btnSpaNav = document.getElementById('btnSpaNav');
  btnSpaNav.addEventListener('click', () => {
    window.location.hash = `#/view/dashboard-${Math.floor(Math.random() * 100)}`;
  });

  // 15. Unsafe Consequential Actions
  const btnDeleteAccount = document.getElementById('btnDeleteAccount');
  const btnCheckoutPay = document.getElementById('btnCheckoutPay');
  btnDeleteAccount.addEventListener('click', () => {
    alert('Simulated Consequential Action: User Account Deleted.');
  });
  btnCheckoutPay.addEventListener('click', () => {
    alert('Simulated Consequential Action: $99.00 Payment Authorized.');
  });
});
