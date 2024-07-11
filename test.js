const dataset = Array.from({ length: 100 }, (_, i) => ({
  x: i,
  y: Math.random() * 100,
}));

// Get the latest 50 points
const latestPoints = dataset.slice(-50);

const trace = {
  x: latestPoints.map(point => point.x),
  y: latestPoints.map(point => point.y),
  type: 'scatter',
  mode: 'lines+markers',
  name: 'Sample Data'
};

const layout = {
  title: 'Latest 50 Points with Pan and Zoom',
  xaxis: {
    title: 'Index',
    range: [dataset.length - 50, dataset.length - 1],
    autorange: false
  },
  yaxis: {
    title: 'Value',
  }
};

const config = {
  responsive: true,
  scrollZoom: true, // Enable scroll zooming
};

Plotly.newPlot('myDiv', [trace], layout, config).then(() => {
  // Update the plot to enable panning and zooming
  const update = {
    xaxis: {
      range: [dataset.length - 50, dataset.length - 1]
    }
  };

  Plotly.relayout('myDiv', update);
});