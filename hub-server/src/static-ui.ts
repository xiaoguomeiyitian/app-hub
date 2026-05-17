/** 右上角浮动导航栏（hub-server 静态页面注入用） */
export const NAV_BAR = `
<style>
  #oc-nav-bar {
    position: fixed;
    top: clamp(10px, 2vw, 16px);
    right: clamp(10px, 2vw, 16px);
    z-index: 2147483647;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  #oc-nav-bar > a {
    color: #fff;
    text-decoration: none;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 15px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(99,102,241,0.98), rgba(139,92,246,0.96));
    border: 1px solid rgba(255,255,255,0.24);
    box-shadow: 0 10px 28px rgba(0,0,0,0.34);
    transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
    pointer-events: auto;
    position: relative;
    z-index: 2147483647;
    backdrop-filter: saturate(140%) blur(8px);
    white-space: nowrap;
    max-width: calc(100vw - 16px);
  }
  #oc-nav-bar > a:hover {
    transform: translateY(-1px) scale(1.03);
    filter: brightness(1.08);
    box-shadow: 0 12px 34px rgba(0,0,0,0.4);
  }
  @media (max-width: 768px) {
    #oc-nav-bar { top: 8px; right: 8px; }
    #oc-nav-bar > a { padding: 8px 10px; font-size: 12px; max-width: calc(100vw - 16px); }
    #oc-nav-label { display: none; }
  }
</style>
<div id="oc-nav-bar" class="oc-nav-bar">
  <a id="oc-nav-home-link" href="#" class="oc-nav-bar"><span>🏠</span> <span id="oc-nav-label">返回应用大厅</span></a>
</div>
<script>
(function(){
  // 应用大厅首页固定为根路径 /
  var link = document.getElementById('oc-nav-home-link');
  if (link) link.href = '/';
})();
</script>
`;


