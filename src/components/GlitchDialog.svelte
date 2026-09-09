<svelte:options customElement={{ tag: 'glitch-dialog', shadow: 'none' }} />

<script>
  import { onMount } from 'svelte';

  const STORAGE_KEY = 'gleech_seen_info';
  let dialogEl;

  export function open() {
    if (dialogEl && !dialogEl.open) {
      dialogEl.showModal();
    }
  }

  export function close() {
    if (dialogEl && dialogEl.open) {
      dialogEl.close();
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }

  function handleBackdropClick(e) {
    if (e.target === dialogEl) {
      close();
    }
  }

  onMount(() => {
    // Attach listener to external info_btn if it exists in DOM
    const infoBtn = document.getElementById('info_btn');
    if (infoBtn) {
      infoBtn.onclick = (e) => {
        e.preventDefault();
        open();
        return false;
      };
    }

    // Check localStorage to avoid repetitive popup modal
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen && document.referrer.indexOf('gleech') === -1 && document.referrer.indexOf('Glitchy3bitdither') === -1) {
      // Show only on first external visit
      open();
    }

    // Listen to native dialog cancel / close
    if (dialogEl) {
      dialogEl.addEventListener('close', () => {
        localStorage.setItem(STORAGE_KEY, 'true');
      });
    }
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog id="info" bind:this={dialogEl} on:click={handleBackdropClick}>
  <span>
    <h1>Gleech</h1>
    <p>Gleech is a universal CLI and web-based image glitching and 3-bit dithering utility, modernized and maintained as a fork of Glitchy3bitDither. It can randomly choose between algorithms, and many algorithms randomly mutate themselves.
      You can choose different encodings, effects, and emulate several glitch techniques, resulting in aleatoric new images and hidden configurations.</p>
    <p style="font-size:1.25em"> If you like it, and want to suport further development please <a href="https://www.paypal.me/JKirchartz/5" target="_blank" rel="noreferrer">buy me a beer</a> or better yet, <a href="http://www.amazon.com/gp/registry/wishlist/3GSO7QPHQCDPJ/" target="_blank" rel="noreferrer">a book</a>
    </p>
    <p>Check out some curated images at <a href="http://glitches.jkirchartz.com/" target="_blank" rel="noreferrer">glitches.jkirchartz.com</a></p>
    <p>This runs completely client-side, using the FileReader, canvas, OffscreenCanvas, and Web Worker APIs; your image is never uploaded to any server. You can right-click and save the result of the processing.</p>
    <p>A modernized fork of <a href="https://github.com/jkirchartz/Glitchy3bitdither" target="_blank" rel="noreferrer">Glitchy3bitDither</a> by JKirchartz, originally based on Nolan Caudill's <a href="https://github.com/mncaudill/3bitdither" target="_blank" rel="noreferrer">3bitdither</a>.</p>
    <!-- svelte-ignore a11y-invalid-attribute -->
    <a href="#" id="close_btn" on:click|preventDefault={close}>×</a>
  </span>
</dialog>
