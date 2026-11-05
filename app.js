'use strict';
const status = document.getElementById('status');
const source = document.getElementById('source-code');
let scriptText = '';
fetch('Gold_Portfolio_Chart.js')
  .then(response => { if (!response.ok) throw new Error('โหลดไม่สำเร็จ'); return response.text(); })
  .then(text => {
    if (!text.includes('Script.complete()')) throw new Error('ไฟล์ไม่ครบ');
    scriptText = text;
    source.value = text;
    document.querySelectorAll('[data-copy]').forEach(button => { button.disabled = false; });
    status.textContent = 'โค้ด v2.1 พร้อมคัดลอก';
  })
  .catch(() => {
    source.value = 'โหลดโค้ดไม่สำเร็จ กรุณาดาวน์โหลดไฟล์ .js จากลิงก์ด้านบน';
    status.textContent = 'โหลดโค้ดไม่สำเร็จ ลองรีเฟรช หรือกดดาวน์โหลด .js';
  });
document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    if (!scriptText) return;
    try {
      await navigator.clipboard.writeText(scriptText);
      status.textContent = 'คัดลอกแล้ว ✓ เปิด Scriptable แล้ววางโค้ดได้เลย';
      const label = button.textContent;
      button.textContent = 'คัดลอกแล้ว ✓';
      setTimeout(() => { button.textContent = label; }, 2500);
    } catch {
      document.getElementById('code-details').open = true;
      source.focus();
      source.select();
      source.setSelectionRange(0, source.value.length);
      status.textContent = 'เลือกโค้ดให้แล้ว กดคัดลอกจากเมนู หรือกด ⌘C / Ctrl+C';
      source.scrollIntoView({block: 'center'});
    }
  });
});
