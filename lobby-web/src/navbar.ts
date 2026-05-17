/** 应用大厅导航栏注入模板 - 顶部通栏（lobby-web 用） */
export const NAV_BAR = `
<style>
  .oc-nav-link:hover {
    background: linear-gradient(135deg, rgba(99,102,241,0.38), rgba(139,92,246,0.3)) !important;
    transform: translateY(-1px) !important;
    border-color: rgba(255,255,255,0.28) !important;
  }
</style>
<div id="oc-nav-bar" class="oc-nav-bar" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(15,12,41,0.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.1);padding:8px 16px;display:flex;align-items:center;gap:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;pointer-events:auto;min-height:40px;">
  <a id="oc-nav-home-link" href="#" class="oc-nav-link" style="color:#fff;text-decoration:none;font-size:14px;display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;background:linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.22));border:1px solid rgba(255,255,255,0.18);box-shadow:0 4px 14px rgba(0,0,0,0.18);transition:transform 0.2s, background 0.2s, border-color 0.2s;pointer-events:auto;position:relative;z-index:100000;">
    🏠 <span id="oc-nav-label">返回应用大厅</span>
  </a>
</div>
<script>
(function(){
  document.documentElement.style.scrollPaddingTop = '48px';
  document.body.style.paddingTop = '48px';

  // 动态计算应用大厅首页 URL
  var path = window.location.pathname;
  var match = path.match(/^(\\/[^\\/]+\\/[^\\/]+)\\/?/);
  var baseUrl = match ? match[1] : '/openclaw/20008';
  if (!baseUrl.endsWith('/')) baseUrl += '/';
  var link = document.getElementById('oc-nav-home-link');
  if (link) link.href = baseUrl;

  var nav = document.getElementById('oc-nav-bar');
  if (nav) {
    ['touchstart','touchend','touchmove','mousedown','mouseup','click'].forEach(function(evt){
      nav.addEventListener(evt, function(e){ e.stopPropagation(); }, { capture: true });
    });
  }
})();
</script>`;
