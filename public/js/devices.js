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
      uirevision:'true',
      xaxis: {
        title: 'Time',
        type: 'category',
        dtick: 1,
      },
      yaxis: {
        title: 'Temperature'
      }
    };

    const config = {
      responsive: true,
      scrollZoom: true,
      displaylogo: false,
      showEditInChartStudio: true,
      plotlyServerURL: "https://chart-studio.plotly.com"
    };

    Plotly.newPlot('myPlotlyChart', [trace], layout, config);
    plotlyChart = document.getElementById('myPlotlyChart');
  }

  // function formatTimestampLong(timestamp) {
  //   const date = new Date(timestamp);
  //   const options = {
  //     year: 'numeric',
  //     month: 'short',
  //     day: '2-digit',
  //     hour: '2-digit',
  //     minute: '2-digit',
  //     second: '2-digit',
  //   };
  //   return date.toLocaleDateString('en-US', options);
  // }

  // function formatTimestampShort(timestamp) {
  //   const date = new Date(timestamp);
  //   const options = {
  //     hour: '2-digit',
  //     minute: '2-digit',
  //     second: '2-digit',
  //   };
  //   return date.toLocaleTimeString('en-US', options);
  // }
  

// Function to update the chart data and title
function updateChartData(newData, type, option, boardNum = null) {
  chartData = newData;
  console.log(option);

  if (type === 'Category') {
    // Get unique board numbers from the data, filter out undefined, and sort in ascending order
    let boardNumbers = [...new Set(newData.map(d => d.boardId))].filter(b => b !== undefined).sort((a, b) => a - b);
    console.log(boardNumbers);

    const normalizedOption = option.charAt(0).toLowerCase() + option.slice(1);
    const controlLimits = {
      temperature: { upper: 255, lower: 145 },
      p1: { upper: 65, lower: 15 },
      p2: { upper: 65, lower: 15 },
      t1: { upper: 65, lower: 15 },
      t2: { upper: 65, lower: 15 },
      vx: { upper: 65, lower: 15 },
      vz: { upper: 65, lower: 15 },
      ct: { upper: 65, lower: 15 },
      vt: { upper: 65, lower: 15 },
      // Add more options and their control limits here
    };
    // Compute the maximum index from all boards
    let maxIndex = 0;
    const upperControlLimit = controlLimits[normalizedOption]?.upper || 255; // Default to 255 if not found
    const lowerControlLimit = controlLimits[normalizedOption]?.lower || 145; // Default to 145 if not found
    // Create traces for each board number
    const traces = boardNumbers.map(boardId => {
      const boardData = newData.filter(d => d.boardId === boardId && d[normalizedOption] !== undefined);
      if (boardData.length > maxIndex) {
        maxIndex = boardData.length;
      }
      return {
        x: boardData.map((_, index) => index), // Use index as x value
        y: boardData.map(d => d[normalizedOption]), // Display P1 values on the y-axis
        mode: 'lines',
        name: `Board ${boardId}`, // Use the board number for the trace name
        text: boardData.map(d => d.timestamp), // Add timestamps for hover info
        hoverinfo: 'y+text', // Display x, y, and timestamp on hover
        connectgaps: true
      };
    });

    // Create control limit traces using maxIndex
    const indexRange = Array.from({ length: maxIndex }, (_, index) => index);
    const upperControlTrace = {
      x: indexRange,
      y: Array(maxIndex).fill(upperControlLimit),
      mode: 'lines',
      name: 'Upper Control Limit',
      line: { dash: 'dash', color: 'red' },
      hoverinfo: 'y'
    };

    const lowerControlTrace = {
      x: indexRange,
      y: Array(maxIndex).fill(lowerControlLimit),
      mode: 'lines',
      name: 'Lower Control Limit',
      line: { dash: 'dash', color: 'blue' },
      hoverinfo: 'y'
    };

    const layout = {
      title: `Category ${option} Over Time`,
      uirevision: 'true',
      xaxis: {
        title: 'Index',
        type: 'category',
        dtick: 1,
      },
      yaxis: {
        title: option,
        autorange: true,
      },
      xaxis:{
        range: [boardNumbers.length-(boardNumbers.length-25),boardNumbers.length-boardNumbers.length], // Set initial range dynamically
      }
    };
    // Combine all traces into a single array
    const allTraces = [...traces, upperControlTrace, lowerControlTrace];
    Plotly.react(plotlyChart, allTraces, layout);
  } else {
    const normalizedOption = option.charAt(0).toLowerCase() + option.slice(1);
    if (option === 'All') {
      const boardOptions = ["p1", "p2", "t1", "t2", "vx", "vz", "ct", "vt"];
      // Set the timestamp on the x-axis, and all the data plotted as lines
      // With the legend on the side to control
      const traces = boardOptions.map(opt => ({
        x: newData.filter(d => d[opt] !== undefined).map(d => d.timestamp),
        y: newData.filter(d => d[opt] !== undefined).map(d => d[opt]), // Use the normalized option to map y values
        mode: 'lines',
        name: opt.toUpperCase(), // Use the original option for the name
        connectgaps: true
      }));
      // Add temperature trace using secondary y-axis
      const temperatureTrace = {
        x: newData.map(d => d.timestamp),
        y: newData.map(d => d.temperature),
        mode: 'lines',
        name: 'Oven Temp',
        yaxis: 'y2',
        line: {
          color: 'red'
        }
      };

      // Add temperature trace to traces array
      traces.push(temperatureTrace);

      const layout = {
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${option.charAt(0).toUpperCase() + option.slice(1)} Over Time`,
        uirevision: 'true',
        xaxis: {
          title: 'Time',
          type: 'category',
          dtick: 1,
        },
        yaxis: {
          title: 'Metrics', // Adjust this field based on your data
          autorange: true,
          side: 'left'
        },
        xaxis:{
          range: [newData.length-(newData.length-25),newData.length-newData.length], // Set initial range dynamically
        },
        yaxis2: {
          title: 'Temperature',
          overlaying: 'y',
          side: 'right'
        }
      };

      Plotly.react(plotlyChart, traces, layout);
    } else {
      const controlLimits = {
        temperature: { upper: 255, lower: 145 },
        p1: { upper: 65, lower: 15 },
        p2: { upper: 65, lower: 15},
        t1: { upper: 65, lower: 15 },
        t2: { upper: 65, lower: 15 },
        vx: { upper: 65, lower: 15},
        vz: { upper: 65, lower: 15},
        ct: { upper: 65, lower: 15},
        vt: { upper: 65, lower: 15},
        // Add more options and their control limits here
      };
      
      const upperControlLimit = controlLimits[normalizedOption]?.upper || 255; // Default to 255 if not found
      const lowerControlLimit = controlLimits[normalizedOption]?.lower || 145; // Default to 145 if not found
      console.log(chartData)
      const filteredData = chartData.filter(d => d[normalizedOption] !== undefined);
      const trace = {
        x: filteredData.map(d => d.timestamp),
        y: filteredData.map(d => d[normalizedOption]), // Use the normalized option to map y values
        mode: 'lines',
        name: option, // Use the original option for the name
        connectgaps: true
      };

      // Upper control limit trace
      const upperControlTrace = {
        x: filteredData.map(d => d.timestamp),
        y: new Array(filteredData.length).fill(upperControlLimit), // Fill array with upper control limit value
        mode: 'lines',
        name: 'Upper Control Limit',
        line: {
          dash: 'dash',
          color: 'red'
        }
      };

      // Lower control limit trace
      const lowerControlTrace = {
        x: filteredData.map(d => d.timestamp),
        y: new Array(filteredData.length).fill(lowerControlLimit), // Fill array with lower control limit value
        mode: 'lines',
        name: 'Lower Control Limit',
        line: {
          dash: 'dash',
          color: 'blue'
        }
      };

      const layout = {
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${option.charAt(0).toUpperCase() + option.slice(1)} ${type === 'Board' ? `Board ${boardNum}` : ''} Over Time`,
        uirevision:'true',
        xaxis: {
          title: 'Time',
          type: 'category',
          dtick: 1,
        },
        yaxis: {
          title: option, // Adjust this field based on your data
          autorange: true,
        },
        xaxis:{
          range: [filteredData.length-(filteredData.length-25),filteredData.length-filteredData.length], // Set initial range dynamically
        }
      };

      Plotly.react(plotlyChart, [trace,upperControlTrace,lowerControlTrace], layout);
    }
  }
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

      chartData = data; // Initialize chartData with the fetched data
      console.log(chartData);
      updateChartData(chartData, type, option, boardNum);
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
      setupDropdownEventListeners('drop2',oven);
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
                  <li data-category="Category">Category</li>
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
      setupDropdownEventListeners('drop4',oven);
      setupDynamicDropdown(oven);
      setupDropdownEventListeners('drop3',oven);
      initializeChart([], 'Oven Temperature Over Time'); // Initialize the chart with empty data and default title
      fetchOvenData(
        oven.name !== undefined ? oven.name : oven.firstChild.innerHTML, 
        document.querySelectorAll('.selected')[1].innerHTML, 
        document.querySelectorAll('.selected')[2].innerHTML, 
        document.querySelectorAll('.selected')[3]?.innerHTML
      );

    } else {
      viewmain.innerHTML = `<h2>OTHER CONTENT</h2>`;
    }
  }

  // Function to set up event listeners for the dropdown
  function setupDropdownEventListeners(dropdownId,oven) {
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
          const type = document.querySelector('#drop3 .selected').innerText;
          const option = document.querySelector('#drop4 .selected').innerText;
          const boardNumber = document.querySelector('#drop5 .selected')?.innerText;
          if (oven instanceof Element) {
            console.log("Und",oven)
            const ovenIdTemp = oven.firstChild.innerHTML
            fetchOvenData(ovenIdTemp, type, option, boardNumber);
          }
          else{          
            console.log("Defiend",oven)
            fetchOvenData(oven.name, type, option, boardNumber);}
        }
      });
    });
  }
  setupDropdownEventListeners("drop1");

  // Function to set up dynamic dropdown based on selection
  function setupDynamicDropdown(oven) {
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
        const boardOptions = ["All","P1", "P2", "T1", "T2", "Vx","Vz","Ct","Vt"];
        for (let i = 0; i <= 8; i++) {
          const li = document.createElement('li');
          li.textContent = boardOptions[i];
          li.dataset.category = boardOptions[i];
          menu4.appendChild(li);
        }
        selected4.innerText = 'All';
        dropdown5.classList.remove('hidden');
      }
      else if (selectedCategory === 'Category'){
        const boardOptions = ["P1", "P2", "T1", "T2", "Vx","Vz","Ct","Vt"];
        for (let i = 0; i <= 7; i++) {
          const li = document.createElement('li');
          li.textContent = boardOptions[i];
          li.dataset.category = boardOptions[i];
          menu4.appendChild(li);
        }
        selected4.innerText = 'P1';
        dropdown5.classList.add('hidden');
      }
      // Re-apply the event listeners for the newly added options
      setupDropdownEventListeners("drop4",oven);
      setupDropdownEventListeners('drop5',oven);
    };

    const updateDrop5Options = (oven) => {
      const maxBoards = maxBoardsPerOven[oven.name] || maxBoardsPerOven[oven.firstChild.innerHTML] || 1; // Default to 1 if ovenId not found
      menu5.innerHTML = '';
      for (let i = 1; i <= maxBoards; i++) {
        const li = document.createElement('li');
        li.textContent = `${i}`;
        li.dataset.category = `${i}`;
        if (i === 1) li.classList.add('active-menu');
        menu5.appendChild(li);
      }
      selected5.innerText = '1';
    };

    dropdown3.querySelectorAll('.menu li').forEach(option3 => {
      option3.addEventListener("click", () => {
        updateDrop4Options(option3.dataset.category);
        setupDropdownEventListeners("drop4",oven);
      });
    });
    updateDrop5Options(oven);

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
      console.log(document.querySelector('.selected-list').firstChild.innerHTML);
      console.log(message.data.ovenId);
      currentOven = document.querySelector('.selected-list').firstChild.innerHTML;
      currentType = document.querySelectorAll('.selected')[1].innerHTML;
      currentOption = document.querySelectorAll('.selected')[2].innerHTML;
      currentBoard = document.querySelectorAll('.selected')[3]?.innerHTML;
      if (currentOven && currentOven === message.data.ovenId) {
          if(currentType === 'Board' && currentBoard && currentBoard !== message.data.boardId){
            console.log(`skipping data for board ${message.data.boardId} as it does not match the current board ${currentBoard}`)
            return
          }
          chartData.unshift(message.data)
          updateChartData(chartData, currentType, currentOption, currentBoard);
        }
    }
  });
});
