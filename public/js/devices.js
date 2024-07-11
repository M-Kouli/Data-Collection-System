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

  // Assume this information is known or fetched from the server
  const maxBoardsPerOven = {
    "Gollum": 5,
    "Treebeard": 3,
    "Gimli": 4,
    "Saruman": 6,
    "Galadriel": 2,
    "Peregrin": 7,
    "Frodo": 4
  };

  // Plotly setup
  let plotlyChart;

  function initializeChart(data, title = 'Oven Temperature Over Time') {
    const trace = {
      x: data.map(d => d.timestamp), // Assuming data has a timestamp field
      y: data.map(d => d.temperature), // Assuming data has a temperature field
      mode: 'lines',
      name: 'Temperature'
    };

    const layout = {
      title: title,
      xaxis: {
        title: 'Time',
        type: 'date'
      },
      yaxis: {
        title: 'Temperature'
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

  // Function to update the chart data and title
  function updateChartData(newData, type, option, boardNum = null) {
    chartData = newData;
    // Ensure the option string is in the correct case (usually camelCase)
    const normalizedOption = option.charAt(0).toLowerCase() + option.slice(1);

    const trace = {
        x: newData.map(d => d.timestamp),
        y: newData.map(d => d[normalizedOption]), // Use the normalized option to map y values
        mode: 'lines',
        name: option, // Use the original option for the name
    };

    const layout = {
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${option.charAt(0).toUpperCase() + option.slice(1)} ${type === 'Board' ? `Board ${boardNum}` : ''} Over Time`,
      xaxis: {
        title: 'Time',
        type: 'date'
      },
      yaxis: {
        title: option // Adjust this field based on your data
      }
    };

    Plotly.react(plotlyChart, [trace], layout);
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
  async function fetchOvenData(ovenId, type, option, boardNum = null) {
    try {
      let url = `/ovenData/${ovenId}?type=${type}&option=${option.toLowerCase()}`;
      if (type === 'Board' && boardNum) {
        url += `&boardNum=${boardNum}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);
      chartData = data; // Initialize chartData with the fetched data
      updateChartData(data, type, option, boardNum);
    } catch (error) {
      console.error('Error fetching oven data:', error);
      updateChartData([], type, option, boardNum); // Update chart with empty data if error occurs
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
          <div class="dropdown hidden" id="drop5">
              <div class="select">
                  <span class="selected">1</span>
                  <div class="caret"></div>
              </div>
              <ul class="menu">
                  <li data-category="1" class="active-menu">1</li>
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
      setupDropdownEventListeners('drop5');
      setupDropdownEventListeners('drop4');
      setupDynamicDropdown();
      setupDropdownEventListeners('drop3');
      initializeChart([], 'Oven Temperature Over Time'); // Initialize the chart with empty data and default title
      fetchOvenData(selectedOven.firstChild.innerHTML, document.querySelectorAll('.selected')[1].innerHTML, document.querySelectorAll('.selected')[2].innerHTML, document.querySelectorAll('.selected')[3]?.innerHTML)
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
        if (dropdownId === 'drop3' || dropdownId === 'drop4' || dropdownId === 'drop5') {
          const ovenId = document.querySelector(".selected-list").firstChild.innerHTML;
          const type = document.querySelector('#drop3 .selected').innerText;
          const option = document.querySelector('#drop4 .selected').innerText;
          const boardNumber = document.querySelector('#drop5 .selected')?.innerText;
          fetchOvenData(ovenId, type, option, boardNumber);
        }
      });
    });
  }
  setupDropdownEventListeners("drop1");

  // Function to set up dynamic dropdown based on selection
  function setupDynamicDropdown() {
    const dropdown3 = document.getElementById("drop3");
    const selected3 = dropdown3.querySelector(".selected");
    const menu4 = document.getElementById("drop4").querySelector(".menu");
    const selected4 = document.getElementById("drop4").querySelector(".selected");
    const dropdown5 = document.getElementById("drop5");
    const menu5 = document.getElementById("drop5").querySelector(".menu");
    const selected5 = document.getElementById("drop5").querySelector(".selected");

    const updateDrop4Options = (selectedCategory) => {
      menu4.innerHTML = '';
      if (selectedCategory === 'Oven') {
        const li = document.createElement('li');
        li.textContent = 'Temperature';
        li.dataset.category = 'Temperature';
        li.classList.add('active-menu');
        menu4.appendChild(li);
        selected4.innerText = 'Temperature';
        dropdown5.classList.add('hidden');
      } else if (selectedCategory === 'Board') {
        const boardOptions = ["P1", "P2", "T1", "T2", "Vx","Vz","Ct","Vt"];
        for (let i = 0; i <= 7; i++) {
          const li = document.createElement('li');
          li.textContent = boardOptions[i];
          li.dataset.category = boardOptions[i];
          menu4.appendChild(li);
        }
        selected4.innerText = 'P1';
        dropdown5.classList.remove('hidden');
      }
      // Re-apply the event listeners for the newly added options
      setupDropdownEventListeners("drop4");
      setupDropdownEventListeners('drop5');
    };

    const updateDrop5Options = (ovenId) => {
      const maxBoards = maxBoardsPerOven[ovenId] || 1; // Default to 1 if ovenId not found
      menu5.innerHTML = '';
      for (let i = 1; i <= maxBoards; i++) {
        const li = document.createElement('li');
        li.textContent = `${i}`;
        li.dataset.category = `${i}`;
        if (i === 1) li.classList.add('active-menu');
        menu5.appendChild(li);
      }
      selected5.innerText = '1';
      // Re-apply the event listeners for the newly added options
      setupDropdownEventListeners("drop5");
    };

    dropdown3.querySelectorAll('.menu li').forEach(option3 => {
      option3.addEventListener("click", () => {
        updateDrop4Options(option3.dataset.category);
        setupDropdownEventListeners("drop4");
      });
    });

    updateDrop5Options(document.querySelector(".selected-list").firstChild.innerHTML);

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
    console.log('Received message:', message);

    if (message.type === 'newOven') {
      console.log('New oven added:', message.data);
      ovens.push(message.data);
      renderOvens(ovens);
    } else if (message.type === 'updateOven') {
      console.log('Oven updated:', message.data);
      const index = ovens.findIndex(oven => oven._id === message.data._id);
      if (index !== -1) {
        ovens[index] = message.data;
        renderOvens(ovens);
      }
    } else if (message.type === 'deleteOven') {
      console.log('Oven deleted:', message.data);
      ovens = ovens.filter(oven => oven._id !== message.data._id);
      renderOvens(ovens);
    } else if (message.type === 'newOvenData') {
      console.log('New oven data:', message.data);
      if (selectedOven && selectedOven.dataset.id === message.data.ovenId) {
        chartData.push(message.data);
        updateChartData(chartData, message.data.dataType, message.data.option, message.data.boardNum);
      }
    }
  });
});
