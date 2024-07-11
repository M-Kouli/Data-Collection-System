document.addEventListener('DOMContentLoaded', async () => {
    const ovenContainer = document.getElementById('oven-container');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const viewFrameName = document.querySelector('.view-header-name');
    const viewmain = document.querySelector('.view-main');
    const viewOptions = document.querySelectorAll('.view-option');
    let ovens = [];
    let selectedOven = null;
    let chartData = [];
  
    // Plotly setup
    let plotlyChart;
  
    function initializeChart(data) {
      const trace = {
        x: data.map(d => d.timestamp), // Assuming data has a timestamp field
        y: data.map(d => d.temperature), // Assuming data has a temperature field
        mode: 'lines',
        name: 'Temperature'
      };
  
      const layout = {
        title: 'Oven Temperature Over Time',
        xaxis: {
          title: 'Time',
          type: 'date'
        },
        yaxis: {
          title: 'Temperature (°C)'
        }
      };
  
      const config = {
        responsive: true,
        scrollZoom: true,
        displaylogo: false,
        modeBarButtonsToAdd: [{
          name: 'Download plot',
          icon: Plotly.Icons.camera,
          click: function (gd) {
            Plotly.downloadImage(gd, {
              format: 'png',
              filename: 'chart'
            });
          }
        }]
      };
  
      Plotly.newPlot('myPlotlyChart', [trace], layout, config);
      plotlyChart = document.getElementById('myPlotlyChart');
    }
  
    // Function to update the chart data
    function updateChartData(newData,type,option) {
      chartData = newData;
      Plotly.react(plotlyChart, [{
        x: newData.map(d => d.timestamp),
        y: newData.map(d => d.temperature),
        mode: 'lines',
        name: 'Temperature',
        title: type + option + 'Over Time',
      }]);
    }
  
    // Fetch oven data
    async function fetchOvens() {
      try {
        const response = await fetch('/ovens');
        ovens = await response.json();
        renderOvens(ovens);
      } catch (error) {
        console.error('Error fetching ovens:', error);
      }
    }
  
    // Fetch oven or board data
    async function fetchOvenData(ovenId, type, option) {
      try {
        const response = await fetch(`/ovenData/${ovenId}?type=${type}&option=${option}`);
        const data = await response.json();
        updateChartData(data,type,option);
      } catch (error) {
        console.error('Error fetching oven data:', error);
      }
    }
  
    // Render ovens to the DOM
    function renderOvens(ovens) {
      ovenContainer.innerHTML = '';
      ovens.forEach((oven, index) => {
        const ovenDiv = document.createElement('div');
        ovenDiv.classList.add('list-wrapper');
        if (index === 0) {
          ovenDiv.classList.add('selected-list');
          selectedOven = ovenDiv;
          updateViewFrame(oven);
          updateMainView(oven);
        }
  
        const nameDiv = document.createElement('div');
        nameDiv.classList.add('list-name');
        nameDiv.textContent = oven.name;
  
        const activityDiv = document.createElement('div');
        activityDiv.classList.add('list-activity');
        activityDiv.innerHTML = '<span class="dot"></span><p>Active: </p><span>0s</span>';
  
        const tagsDiv = document.createElement('div');
        tagsDiv.classList.add('list-tags');
        tagsDiv.innerHTML = `<div class="tag">${oven.category}</div>`;
  
        const usageDiv = document.createElement('div');
        usageDiv.classList.add('list-usage');
        usageDiv.innerHTML = `
          <span>Oven Temperature</span>
          <div class="percent-display">
            <h2><span>0</span> °C</h2>
            <p class="up-base"><i class='bx bx-up-arrow-alt'></i><span>0</span>%
              <span>up</span> from baseline
            </p>
          </div>
        `;
  
        ovenDiv.appendChild(nameDiv);
        ovenDiv.appendChild(activityDiv);
        ovenDiv.appendChild(tagsDiv);
        ovenDiv.appendChild(usageDiv);
  
        // Add event listener to toggle .selected-list class
        ovenDiv.addEventListener('click', () => {
          if (selectedOven) {
            selectedOven.classList.remove('selected-list');
          }
          ovenDiv.classList.add('selected-list');
          selectedOven = ovenDiv;
          updateViewFrame(oven);
          updateMainView(oven);
        });
  
        ovenContainer.appendChild(ovenDiv);
      });
    }
  
    // Function to update the .view-frame with selected oven information
    function updateViewFrame(oven) {
      viewFrameName.innerHTML = `
        <div class="view-header-name-cont">
        <h2>${oven.name}</h2>
        <span class="dot"></span>
        <p>Active: 0s</p>
        </div>
        <div class="arrow-nav">
        <i class='bx bx-chevron-left' id="nav-arrow-left"></i>
              <p>${ovens.indexOf(oven) + 1} of ${ovens.length} </p>
        <i class='bx bx-chevron-right' id="nav-arrow-right"></i>
        </div>
      `;
    }
  
    // Function to update the main view based on the selected tab
    function updateMainView(oven) {
      const activeTab = document.querySelector('.view-option.view-active').dataset.view;
      if (activeTab === 'Overview') {
        viewmain.innerHTML = `
          <div class="main-filter">
            <div class="dropdown" id="drop2">
              <div class="select">
                <span class="selected">Last 7 Days</span>
                <div class="caret"></div>
              </div>
              <ul class="menu">
                <li data-category="All" class=".active-menu">Last 7 Days</li>
                <li data-category="E Series">Last Month</li>
                <li data-category="C Series">Last 6 Months</li>
                <li data-category="Schlumberger">Last Year</li>
              </ul>
            </div>
          </div>
          <div class="main-sec1">
            <div class="main-sec1-header">
              <div class="main-sec1-cards view-active">
                <p>Oven Temperature</p>
                <h1>0.0 °C</h1>
                <div>
                  <p class="up-base"><i class='bx bx-up-arrow-alt'></i><span>0</span>%
                </div>
              </div>
              <div class="main-sec1-cards">
                <p>Parts</p>
                <h1>0.0%</h1>
                <div>
                  <p class="up-base"><i class='bx bx-up-arrow-alt'></i><span>0</span>%
                </div>
              </div>
              <div class="main-sec1-cards">
                <p>Maintenance Date</p>
                <h1>0s</h1>
                <div>
                  <p class="up-base"><i class='bx bx-up-arrow-alt'></i><span>0</span>%
                </div>
              </div>
              <div class="main-sec1-cards">
                <p>Performance</p>
                <h1>0.0%</h1>
                <div>
                  <p class="up-base"><i class='bx bx-up-arrow-alt'></i><span>0</span>%
                </div>
              </div>
            </div>
            <div class="main-sec1-body"></div>
          </div>
        `;
        setupDropdownEventListeners('drop2');
      } else if (activeTab === 'Tool Monitoring') {
        viewmain.innerHTML = `
  <div class="main-tool-header">
    <div class="dropdown" id="drop3">
      <div class="select">
        <span class="selected">Oven</span>
        <div class="caret"></div>
      </div>
      <ul class="menu">
        <li data-category="Oven" class="active-menu">Oven</li>
        <li data-category="Board">Board</li>
      </ul>
    </div>
    <div class="dropdown" id="drop4">
      <div class="select">
        <span class="selected">Temperature</span>
        <div class="caret"></div>
      </div>
      <ul class="menu">
        <li data-category="Temperature" class="active-menu">Temperature</li>
      </ul>
    </div>
  </div>
  <div class="main-tool">
    <div id="myPlotlyChart"></div>
  </div>
  <div class="main-tool-board">
    <div class="main-tool-board-header">
      <h2>Boards</h2>
    </div>
    <div class="main-tool-board-body">
      <div class="single-board">
        <p>Bank 0 - Card 1</p>
        <P>Pass</p>
      </div>
    </div>
  </div>
        `;
        setupDropdownEventListeners('drop3');
        setupDropdownEventListeners('drop4');
        setupDynamicDropdown();
        initializeChart([]); // Initialize the chart with empty data
      } else {
        viewmain.innerHTML = `<h2>OTHER CONTENT</h2>`;
      }
    }
  
    // Function to set up event listeners for the dropdown
    function setupDropdownEventListeners(dropdownId) {
      const dropdown = document.getElementById(dropdownId);
      if (!dropdown) return;
      const select = dropdown.querySelector('.select');
      const caret = dropdown.querySelector('.caret');
      const menu = dropdown.querySelector('.menu');
      const options = dropdown.querySelectorAll('.menu li');
      const selected = dropdown.querySelector('.selected');
      select.addEventListener('click', () => {
        select.classList.toggle('select-clicked');
        caret.classList.toggle('caret-rotate');
        menu.classList.toggle('menu-open');
      });
      options.forEach(option => {
        option.addEventListener('click', () => {
          selected.innerText = option.innerText;
          select.classList.remove('select-clicked');
          caret.classList.remove('caret-rotate');
          menu.classList.remove('menu-open');
          options.forEach(option => {
            option.classList.remove('active-menu');
          });
          option.classList.add('active-menu');
          // Fetch and update chart data based on the selection
          if (dropdownId === 'drop3' || dropdownId === 'drop4') {
            const ovenId = selectedOven.dataset.id;
            const type = document.querySelector('#drop3 .selected').innerText.toLowerCase();
            const option = document.querySelector('#drop4 .selected').innerText.toLowerCase();
            fetchOvenData(ovenId, type, option);
          }
        });
      });
    }
  
    // Function to set up dynamic dropdown based on selection
    function setupDynamicDropdown() {
      const dropdown3 = document.getElementById("drop3");
      const selected3 = dropdown3.querySelector(".selected");
      const menu4 = document.getElementById("drop4").querySelector(".menu");
      const selected4 = document.getElementById("drop4").querySelector(".selected");
  
      const updateDrop4Options = (selectedCategory) => {
        menu4.innerHTML = '';
        if (selectedCategory === 'Oven') {
          const li = document.createElement('li');
          li.textContent = 'Temperature';
          li.dataset.category = 'Temperature';
          li.classList.add('active-menu');
          menu4.appendChild(li);
          selected4.innerText = 'Temperature';
        } else if (selectedCategory === 'Board') {
          for (let i = 1; i <= 7; i++) {
            const li = document.createElement('li');
            li.textContent = `P${i}`;
            li.dataset.category = `P${i}`;
            menu4.appendChild(li);
          }
          selected4.innerText = 'P1';
        }
        // Re-apply the event listeners for the newly added options
        setupDropdownEventListeners("drop4");
      };
  
      dropdown3.querySelectorAll('.menu li').forEach(option3 => {
        option3.addEventListener("click", () => {
          updateDrop4Options(option3.dataset.category);
          setupDropdownEventListeners("drop4");
        });
      });
    }
    // Event listener for tab options
    viewOptions.forEach(viewOption => {
      viewOption.addEventListener('click', () => {
        viewOptions.forEach(option => {
          option.classList.remove('view-active');
        });
        viewOption.classList.add('view-active');
        if (selectedOven) {
          updateMainView(selectedOven);
        }
      });
    });
  
    // Filter ovens based on search query and selected category
    function filterOvens() {
      const searchQuery = searchInput.value.toLowerCase();
      const selectedCategory = categoryFilter.querySelector('.active-menu').dataset.category;
      const filteredOvens = ovens.filter(oven => {
        const matchesSearch = oven.name.toLowerCase().includes(searchQuery);
        const matchesCategory = selectedCategory === 'All' || oven.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });
      renderOvens(filteredOvens);
    }
  
    // Event listener for search input
    searchInput.addEventListener('input', filterOvens);
  
    // Event listener for category filter
    categoryFilter.addEventListener('click', event => {
      if (event.target.tagName === 'LI') {
        categoryFilter.querySelector('.active-menu').classList.remove('active-menu');
        event.target.classList.add('active-menu');
        filterOvens();
      }
    });
  
    // Fetch ovens on page load
    fetchOvens();
  
    // WebSocket setup
    const socket = new WebSocket(`ws://${window.location.host}`);
  
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.type === 'newOven') {
        ovens.push(message.data);
        renderOvens(ovens);
      } else if (message.type === 'updateOven') {
        const index = ovens.findIndex(oven => oven._id === message.data._id);
        if (index !== -1) {
          ovens[index] = message.data;
          renderOvens(ovens);
        }
      } else if (message.type === 'deleteOven') {
        ovens = ovens.filter(oven => oven._id !== message.data._id);
        renderOvens(ovens);
      } else if (message.type === 'newData') {
        if (selectedOven && selectedOven.dataset.id === message.data.ovenId) {
          chartData.push(message.data);
          updateChartData(chartData);
        }
      }
    });
  });
  