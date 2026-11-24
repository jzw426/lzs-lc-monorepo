(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var target = document.getElementById('chart-tests');
  if (!target) return;

  var chart = echarts.init(target, null, { renderer: 'svg' });
  chart.setOption({
    animation: false,
    color: [accent, accent2],
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      axisPointer: { type: 'shadow' },
      valueFormatter: function (value) {
        return value + ' 项';
      },
    },
    grid: { left: 92, right: 44, top: 18, bottom: 36 },
    xAxis: {
      type: 'value',
      minInterval: 1,
      max: 40,
      name: '通过测试数',
      nameTextStyle: { color: muted },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'category',
      data: ['platform', 'client', 'content', 'server', 'core'],
      axisLabel: { color: ink, fontFamily: 'JetBrainsMono' },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false },
    },
    series: [
      {
        name: '测试',
        type: 'bar',
        data: [4, 4, 5, 25, 35],
        barWidth: 24,
        itemStyle: { color: accent, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: ink, formatter: '{c} 项' },
        backgroundStyle: { color: bg2 },
        showBackground: true,
      },
    ],
  });
  window.addEventListener('resize', function () {
    chart.resize();
  });
})();
