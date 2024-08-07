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
  let highestActiveIDChartData = [];
  let tempData = {};
  let activeOvens = {};
  const timers = {}; // Object to store the intervals for each oven

  // Assume this information is known or fetched from the server
  const maxBoardsPerOven = {
    "Gollum": 5,
    "Treebeard": 3,
    "Gimli": 5,
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
      uirevision: 'true',
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

  // Function to update the chart data and title
  function updateChartData(newData, type, option, boardNum = null) {
    chartData = newData;
    console.log(option);
  
    if (type === 'Category') {
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
      };
  
      let maxIndex = 0;
      const upperControlLimit = controlLimits[normalizedOption]?.upper || 255;
      const lowerControlLimit = controlLimits[normalizedOption]?.lower || 145;
  
      const traces = boardNumbers.map(boardId => {
        const boardData = newData.filter(d => d.boardId === boardId && d[normalizedOption] !== undefined);
        if (boardData.length > maxIndex) {
          maxIndex = boardData.length;
        }
        return {
          x: boardData.map((_, index) => index),
          y: boardData.map(d => d[normalizedOption]),
          mode: 'lines',
          name: `Board ${boardId}`,
          text: boardData.map(d => d.timestamp),
          hoverinfo: 'y+text',
          connectgaps: true
        };
      });
  
      const crossingPoints = newData
        .filter(d => d[normalizedOption] !== undefined && (d[normalizedOption] > upperControlLimit || d[normalizedOption] < lowerControlLimit))
        .map((d, index) => ({
          x: index,
          y: d[normalizedOption],
          timestamp: d.timestamp,
        }));
  
      const crossingTrace = {
        x: crossingPoints.map(d => d.x),
        y: crossingPoints.map(d => d.y),
        mode: 'markers',
        name: 'Crossing Points',
        text: crossingPoints.map(d => d.timestamp),
        hoverinfo: 'y+text',
        marker: { color: 'red', size: 10 },
      };
  
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
        xaxis: {
          range: [boardNumbers.length - (boardNumbers.length - 25), boardNumbers.length - boardNumbers.length],
        }
      };
  
      const allTraces = [...traces, upperControlTrace, lowerControlTrace, crossingTrace];
      Plotly.react(plotlyChart, allTraces, layout);
    } else {
      const normalizedOption = option.charAt(0).toLowerCase() + option.slice(1);
      if (option === 'All') {
        const boardOptions = ["p1", "p2", "t1", "t2", "vx", "vz", "ct", "vt"];
        const traces = boardOptions.map(opt => ({
          x: newData.filter(d => d[opt] !== undefined).map(d => d.timestamp),
          y: newData.filter(d => d[opt] !== undefined).map(d => d[opt]),
          mode: 'lines',
          name: opt.toUpperCase(),
          connectgaps: true
        }));
  
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
            title: 'Metrics',
            autorange: true,
            side: 'left'
          },
          xaxis: {
            range: [newData.length - (newData.length - 25), newData.length - newData.length],
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
          temperature: { value: 10 },
          p1: { value: 50 },
          p2: { value: 50 },
          t1: { value: 50 },
          t2: { value: 50 },
          vx: { value: 50 },
          vz: { value: 50 },
          ct: { value: 50 },
          vt: { value: 50 },
        };
        const filteredData = chartData.filter(d => d[normalizedOption] !== undefined);
        const trace = {
          x: filteredData.map(d => d.timestamp),
          y: filteredData.map(d => d[normalizedOption]),
          mode: 'lines',
          name: option,
          connectgaps: true
        };
  
        const upperControlTrace = {
          x: filteredData.map(d => d.timestamp),
          y: filteredData.map(d => d[normalizedOption + 'UpperControlLimit']),
          mode: 'lines',
          name: 'Upper Control Limit',
          line: {
            dash: 'dash',
            color: 'red'
          }
        };
  
        const lowerControlTrace = {
          x: filteredData.map(d => d.timestamp),
          y: filteredData.map(d => d[normalizedOption + 'LowerControlLimit']),
          mode: 'lines',
          name: 'Lower Control Limit',
          line: {
            dash: 'dash',
            color: 'blue'
          }
        };
  
        const crossingPoints = filteredData
        .filter(d => 
          d[normalizedOption] !== undefined &&
          ((d.hasOvenControlLimits && (d[normalizedOption] > d[normalizedOption + 'UpperControlLimit'] || d[normalizedOption] < d[normalizedOption + 'LowerControlLimit'])) ||
           (d.hasBoardControlLimits && (d[normalizedOption] > d[normalizedOption + 'UpperControlLimit'] || d[normalizedOption] < d[normalizedOption + 'LowerControlLimit'])))
        )
        .map((d) => ({
          x: d.timestamp,
          y: d[normalizedOption],
        }));
  
        const crossingTrace = {
          x: crossingPoints.map(d => d.x),
          y: crossingPoints.map(d => d.y),
          mode: 'markers',
          name: 'Crossing Points',
          marker: { color: 'red', size: 10 },
        };
  
        const firstYValue = trace.y[0];
        const yAxisRange = [firstYValue - controlLimits[normalizedOption].value, firstYValue + controlLimits[normalizedOption].value];
  
        const layout = {
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${option.charAt(0).toUpperCase() + option.slice(1)} ${type === 'Board' ? `Board ${boardNum}` : ''} Over Time`,
          uirevision: 'true',
          xaxis: {
            title: 'Time',
            type: 'category',
            dtick: 1,
          },
          yaxis: {
            title: option,
            autorange: false,
            range: yAxisRange
          },
          xaxis: {
            range: [filteredData.length - (filteredData.length - 25), filteredData.length - filteredData.length],
          }
        };
  
        Plotly.react(plotlyChart, [trace, upperControlTrace, lowerControlTrace, crossingTrace], layout);
      }
    }
  }
  
  function checkOutliers(data) {
    let ovenOutliersCount = 0;
    let boardsWithOutliers = {};
  
    data.forEach(d => {
      // Check for oven temperature outliers
      if (d.dataType === 'Oven' && d.temperature !== undefined) {
        if (d.temperatureUpperControlLimit !== null && d.temperatureLowerControlLimit !== null) {
          if (d.temperature > d.temperatureUpperControlLimit || d.temperature < d.temperatureLowerControlLimit) {
            ovenOutliersCount++;
          }
        }
      }
  
      // Check for board parameter outliers
      if (d.dataType === 'Board') {
        const boardId = d.boardId;
        if (!boardsWithOutliers[boardId]) {
          boardsWithOutliers[boardId] = { failures: {}, totalFails: 0 };
        }
  
        const parameters = ['p1', 'p2', 't1', 't2', 'vx', 'vz', 'ct', 'vt'];
  
        parameters.forEach(param => {
          if (d[param] !== undefined) {
            const lowerLimit = d[`${param}LowerControlLimit`];
            const upperLimit = d[`${param}UpperControlLimit`];
            if (lowerLimit !== null && upperLimit !== null) {
              if (d[param] < lowerLimit || d[param] > upperLimit) {
                if (!boardsWithOutliers[boardId].failures[param]) {
                  boardsWithOutliers[boardId].failures[param] = 0;
                }
                boardsWithOutliers[boardId].failures[param]++;
                boardsWithOutliers[boardId].totalFails++;
              }
            }
          }
        });
      }
    });
  
    console.log(ovenOutliersCount); // Number of oven temperature outliers
    console.log(boardsWithOutliers); // Log of boards with exceeded limits and parameters
    populateOutliers(ovenOutliersCount, boardsWithOutliers);
  }
  
  
// Populate HTML
function populateOutliers(ovenOutliersCount, boardsWithOutliers) {
  const ovenOutliersCountElement = document.getElementById('ovenOutliersCount');
  const boardFailuresCountElement = document.getElementById('boardFailuresCount');
  const boardFailuresDetailsElement = document.getElementById('boardFailuresDetails');

  // Set oven outliers count
  ovenOutliersCountElement.innerText = ovenOutliersCount;

  // Calculate and set board failures count
  const totalBoards = Object.keys(boardsWithOutliers).length;
  const failedBoards = Object.values(boardsWithOutliers).filter(board => board.totalFails > 0).length;
  boardFailuresCountElement.innerText = `${failedBoards} / ${totalBoards}`;

  // Display details of failed boards
  boardFailuresDetailsElement.innerHTML = ''; // Clear previous content
  Object.entries(boardsWithOutliers).forEach(([boardId, boardData]) => {
    if (boardData.totalFails > 0) {
      const boardElement = document.createElement('div');
      boardElement.classList.add('board-failure');
      const failures = Object.entries(boardData.failures)
        .map(([param, count]) => `${param.toUpperCase()}: ${count}`)
        .join(', ');
      boardElement.innerHTML = `<p>Board ${boardId}</p><p>${failures}</p>`;
      boardFailuresDetailsElement.appendChild(boardElement);
    }
  });
}
function checkStats(data) {
  let ovenCount = 0;
  let boardsOutliers = {};

  data.forEach(d => {
    // Check for oven temperature outliers
    if (d.dataType === 'Oven' && d.temperature !== undefined) {
      if (d.temperatureUpperControlLimit !== null && d.temperatureLowerControlLimit !== null) {
        if (d.temperature > d.temperatureUpperControlLimit || d.temperature < d.temperatureLowerControlLimit) {
          ovenCount++;
        }
      }
    }

    // Check for board parameter outliers
    if (d.dataType === 'Board') {
      const boardId = d.boardId;
      if (!boardsOutliers[boardId]) {
        boardsOutliers[boardId] = { failures: {}, totalFails: 0 };
      }

      const parameters = ['p1', 'p2', 't1', 't2', 'vx', 'vz', 'ct', 'vt'];

      parameters.forEach(param => {
        if (d[param] !== undefined) {
          const lowerLimit = d[`${param}LowerControlLimit`];
          const upperLimit = d[`${param}UpperControlLimit`];
          if (lowerLimit !== null && upperLimit !== null) {
            if (d[param] < lowerLimit || d[param] > upperLimit) {
              if (!boardsOutliers[boardId].failures[param]) {
                boardsOutliers[boardId].failures[param] = 0;
              }
              boardsOutliers[boardId].failures[param]++;
              boardsOutliers[boardId].totalFails++;
            }
          }
        }
      });
    }
  });
  return { ovenCount, boardsOutliers };
}

// Function to calculate days difference
function calculateDaysDifference(startDate) {
  const currentDate = new Date();
  const eventDate = new Date(startDate);
  const timeDifference = eventDate - currentDate;
  const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
  return daysDifference;
}

// Function to update event information
function updateEventInfo(data) {
  const eventInfoDiv =  document.querySelectorAll(".main-sec1-cards")[2].querySelector("h1");
  if (!data || !data.start) {
    eventInfoDiv.textContent = '0 d.';
    return;
  }

  const daysDifference = calculateDaysDifference(data.start);

  if (daysDifference >= 1) {
    eventInfoDiv.textContent = `${daysDifference} d.`;
  } else if (daysDifference === 0) {
    eventInfoDiv.textContent = `Today.`;
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
  async function fetchOvenData(ovenId, type, option, boardNum = null, activeID=null) {
    if(activeID){
      try {
        let url = `/activeData/${ovenId}?type=${type}&option=${option.toLowerCase()}&activeID=${activeID}`;
        if (type === 'Board' && boardNum) {
          url += `&boardNum=${boardNum}`;
        }
        const response = await fetch(url);
        const data = await response.json();
  
        highestActiveIDChartData = data; // Initialize chartData with the fetched data
        console.log(highestActiveIDChartData);
        updateChartData(highestActiveIDChartData, type, option, boardNum);
      } catch (error) {
        console.error('Error fetching oven data:', error);
        updateChartData([], type, option, boardNum); // Update chart with empty data if error occurs
      }
    }else{
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
  }

// Fetch the latest temperatures for all ovens
async function fetchAllOvenTemps() {
  try {
    let url = `/latestOvenTemps`; // Endpoint to get the latest temperatures for all ovens
    const response = await fetch(url);
    const data = await response.json();
    
    data.forEach(oven => {
      const ovenId = oven.ovenId;
      currentTab = document.querySelector('.view-active').innerHTML
      const temperature = Math.trunc(oven.temperature);
      tempData[ovenId] = temperature; // Update tempData with the fetched temperature
      console.log(tempData);

      // Update the temperature display in the DOM
      if (document.getElementById(`temp-${ovenId}`)) {
        document.getElementById(`temp-${ovenId}`).innerText = tempData[ovenId];
      }
      if (currentTab === 'Overview' && document.querySelector('.selected-list') && document.querySelector('.selected-list').firstChild.innerHTML === ovenId) {
        document.getElementById('main-temp').innerText = `${tempData[ovenId]}°C`;
      }
    });
  } catch (error) {
    console.error('Error fetching oven data:', error);
  }
}
  async function fetchCurrentStatuses() {
    try {
      const response = await fetch('/currentStatuses');
      const statuses = await response.json();
      statuses.forEach(({ ovenName, status, timestamp }) => {
        updateOvenStatus(ovenName, status, timestamp);
      });
    } catch (error) {
      console.error('Error fetching current statuses:', error);
    }
  }
  
  function updateOvenStatus(ovenName, status, timestamp) {
    // Update the activeOvens object
    activeOvens[ovenName] = { status, timestamp };
  
    // Clear any existing timer
    if (timers[ovenName]) {
      clearInterval(timers[ovenName]);
    }
  
    // Update the status and color in the DOM
    const activityDivSide = document.getElementById(`activity-${ovenName}`);
    const activityDivBody = document.getElementById(`activityBodyTag-${ovenName}`);
    updateStatusAndColor(activityDivSide, status);
    updateStatusAndColor(activityDivBody, status);
  // Reset the timer display to 0s if the status is not 'Active'
  if (status !== 'Active') {
    resetTimerDisplay(activityDivSide);
    resetTimerDisplay(activityDivBody);
  }

  // Start the timer if the status is 'Active'
  if (status === 'Active') {
    startTimer(ovenName, new Date(timestamp));
  }
  }

  function updateStatusAndColor(element, status) {
    if (element) {
      element.querySelector('.status-text').innerText = status;
      const dotElement = element.querySelector('.dot');
      if (status === 'Active') {
        dotElement.style.backgroundColor = 'green';
      } else if (status === 'Idle') {
        dotElement.style.backgroundColor = '#FFBF00';
      } else {
        dotElement.style.backgroundColor = 'maroon';
      }
    }
  }
  function resetTimerDisplay(element) {
    if (element) {
      element.querySelector('.timer').innerText = '0s';
    }
  }
  function startTimer(ovenName, startTime) {
    const activityDivSide = document.getElementById(`activity-${ovenName}`);
    const activityDivBody = document.getElementById(`activityBodyTag-${ovenName}`);
    
    function updateTimer() {
      const currentTime = new Date().getTime();
      const elapsedMilliseconds = currentTime - startTime.getTime();
      
      // Convert milliseconds to seconds
      const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
      
      // Convert seconds to hours, minutes, and seconds
      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = elapsedSeconds % 60;
      
      // Format the elapsed time
      const formattedTime = `${hours}h ${minutes}m ${seconds}s`;
      
      // Update the timer element
      if (activityDivSide) {
        activityDivSide.querySelector('.timer').innerText = formattedTime;
      }
      if (activityDivBody) {
        activityDivBody.querySelector('.timer').innerText = formattedTime;
      }
    }
    
    // Update the timer every second
    timers[ovenName] = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call to set the timer immediately
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
      activityDiv.setAttribute('id', `activity-${oven.name}`);
      activityDiv.innerHTML = `<span class="dot"></span>
                         <p class="status-text">${activeOvens[oven.name]?.status || 'Disconnected:'}</p>
                         <span class="timer">${activeOvens[oven.name]?.time || '0s'}</span>`;

      const tagsDiv = document.createElement('div');
      tagsDiv.classList.add('list-tags');
      tagsDiv.innerHTML = `<div class="tag">${oven.category}</div>`;

      const usageDiv = document.createElement('div');
      usageDiv.classList.add('list-usage');
      usageDiv.innerHTML = `
        <span>Oven Temperature</span>
        <div class="percent-display">
          <h2><span id="temp-${oven.name}">${tempData[oven.name] || 0}</span> °C</h2>
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
      <div id="activityBodyTag-${oven.name}" class="view-header-name-cont">
      <h2>${oven.name}</h2>
      <span class="dot"></span>
      <p class="status-text">${activeOvens[oven.name]?.status || 'Disconnected:'}</p>
      <p class="timer">${activeOvens[oven.name]?.time || '0s'}</p>
      </div>
      <div class="arrow-nav">
      <i class='bx bx-chevron-left' id="nav-arrow-left"></i>
      <p>${ovens.indexOf(oven) + 1} of ${ovens.length} </p>
      <i class='bx bx-chevron-right' id="nav-arrow-right'></i>
      </div>
    `;
  }

  // Function to update the main view based on the selected tab
  async function updateMainView(oven) {
    fetchCurrentStatuses();
    fetchAllOvenTemps();
    const activeTab = document.querySelector('.view-option.view-active').dataset.view;
    if (activeTab === 'Overview') {
      viewmain.innerHTML = `
        <div class="main-filter">
        </div>
        <div class="main-sec1">
          <div class="main-sec1-header">
            <div class="main-sec1-cards">
              <p>Oven Temperature</p>
              <h1 id="main-temp">${(tempData[oven.name] || 0)}°C</h1>
            </div>
            <div class="main-sec1-cards">
              <p>Parts</p>
              <h1>0.0%</h1>
              <div>
                <p class="up-base"><span>0</span>%</p>
              </div>
            </div>
            <div class="main-sec1-cards">
              <p>Maintenance Date</p>
              <h1>0s</h1>
              <div>
                <p class="up-base">Until Next Maintenance Event</p>
              </div>
            </div>
            <div class="main-sec1-cards">
              <p>Performance</p>
              <h1>0.0%</h1>
              <div>
                <p class="up-base">Number of Temperature Outliers</p>
              </div>
            </div>
          </div>
          <div class="main-sec1-body">
            <div id="myPlotlyChart"></div>
          </div>
        </div>
      `;
      try {
        const response = await fetch(`/highestActiveID?ovenName=${oven.name !== undefined ? oven.name : oven.firstChild.innerHTML}`);
        const data = await response.json();
        const highestActiveID = data.highestActiveID;
        console.log(highestActiveID);
        const activeResponse = await fetch(`/downloadExcel?ovenName=${oven.name !== undefined ? oven.name : oven.firstChild.innerHTML}&activeID=${highestActiveID}`);
        const activeData = await activeResponse.json();
        console.log(activeData);
        const { ovenCount, boardsOutliers } = checkStats(activeData);
        // Set oven outliers count
        document.querySelectorAll(".main-sec1-cards")[3].querySelector("h1").innerHTML= ovenCount;

        // Calculate and set board failures count
        const totalBoards = Object.keys(boardsOutliers).length;
        const failedBoards = Object.values(boardsOutliers).filter(board => board.totalFails > 0).length;
        const percentage = ((totalBoards-failedBoards)/totalBoards)*100;
        const displayPercentage = isNaN(percentage) ? 0 : Math.round(percentage);
        document.querySelectorAll(".main-sec1-cards")[1].querySelector("h1").innerHTML = `${displayPercentage} %`;
        document.querySelectorAll(".main-sec1-cards")[1].querySelector(".up-base").innerHTML = `Total Boards: ${totalBoards}`;

        const eventResponse = await fetch(`/closestEvent?ovenId=${oven.name !== undefined ? oven.name : oven.firstChild.innerHTML}`);
        const eventData = await eventResponse.json();
        console.log(eventData);
        // Initial update
        updateEventInfo(eventData);

        // Update every hour
        setInterval(updateEventInfo, 3600000); // 3600000 milliseconds = 1 hour
        initializeChart([], 'Oven Temperature Over Time'); // Initialize the chart with empty data and default title
        fetchOvenData(
          oven.name !== undefined ? oven.name : oven.firstChild.innerHTML, 
          "Oven", 
          "Temperature", 
        );
        console.log(chartData)
      } catch (error) {
        console.error(error);
      }
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
      console.log(chartData)
    } else if(activeTab === 'Diagnostics') {
        viewmain.innerHTML = `
        <div class="main-tool-board">
          <div class="main-tool-board-header">
            <div>
              <p>Run Number: <span id="runNumber">0</span></p>
              <p>Start Date: <span id="startDate">0</span></p>
              <p>End Date: <span id="endDate">0</span></p>
            </div>
          </div>
          <div class="main-tool-board-body">
            <div id="boardOutliersDetails">
              <h3>Overview:</h3>
            </div>
            <div id="ovenOutliers" class="main-tool-board-body-header">
              <p>Oven Outliers: <span id="ovenOutliersCount">0</span></p>
              <p>Board Failures: <span id="boardFailuresCount">0</span></p>
            </div>
            <div id="boardOutliersDetails">
              <h3>Failed Boards:</h3>
            </div>
            <div class="main-tool-board-body-container">
            <div id="boardFailuresDetails" class="main-tool-board-body-content"></div>
            </div>
          </div>
        </div>
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
      `;
      setupDropdownEventListeners('drop4',oven);
      setupDynamicDropdown(oven);
      setupDropdownEventListeners('drop3',oven);
      initializeChart([], 'Oven Temperature Over Time'); // Initialize the chart with empty data and default title
      try {
        const response = await fetch(`/highestActiveID?ovenName=${oven.name !== undefined ? oven.name : oven.firstChild.innerHTML}`);
        const data = await response.json();
        const highestActiveID = data.highestActiveID;
        console.log(highestActiveID);
        document.querySelector('#runNumber').innerHTML = highestActiveID;
        if(highestActiveID>0) {
          await fetchOvenData(
            oven.name !== undefined ? oven.name : oven.firstChild.innerHTML, 
            document.querySelectorAll('.selected')[1].innerHTML, 
            document.querySelectorAll('.selected')[2].innerHTML, 
            document.querySelectorAll('.selected')[3]?.innerHTML,
            highestActiveID
          );
          document.querySelector('#startDate').innerHTML = highestActiveIDChartData[highestActiveIDChartData.length - 1].timestamp
          document.querySelector('#endDate').innerHTML = highestActiveIDChartData[0].timestamp;
          checkOutliers(highestActiveIDChartData);
        }else{
          return
        }

      } catch (error) {
        console.error('Error fetching highest activeID:', error);
      }

    }
    else {
      let selectedRange = null;
      const CurrentOvenName = document.querySelector(".view-header-name-cont").querySelector("h2").innerHTML;
      viewmain.innerHTML = `
      <div class="calendarPage">
        <div class="calendarCont">    
          <div id='calendar'></div>
        </div>
      </div>
  <div id="eventModal" class="modal">
    <div class="modal-content">
      
      <div class="modal-header">Event Details
      <span class="close">&times;</span></div>
      <div class="modal-body">
        <input autocomplete="off" type="text" id="eventTitle" placeholder="Event Title" />
        <textarea id="eventNotes" placeholder="Event Notes"></textarea>
      </div>
      <div class="modal-footer">
      <button class="delete">Delete</button>
      <div class="right-buttons">
        <button class="save">Save</button>
        <button class="cancel">Cancel</button>
      </div>
      </div>
    </div>
  </div>

        <div class="main-tool-board" id="eventMainBoard">
        <h2 class="MaintanenceH2">Select Date Range:</h2>
                
    <div id="eventCounts" class="event-header">
    <input type="text" name="daterange" id="daterange" />
        <p id="promptText">Select dates to show summary</p>
        <div id="summaryText" class="eventCounts" style="display: none;">
            <p>Total Events: <span id="totalEvents">0</span></p>
            <p>Planned Events: <span id="plannedEvents">0</span></p>
            <p>Unplanned Events: <span id="unplannedEvents">0</span></p>
        </div>
            </div>
        <div class="event-summary-section">
    <div class="event-container">
        <h3>Planned Events</h3>
        <div id="plannedEventGrid" class="event-summary-grid"></div>
    </div>

    <div class="event-container">
        <h3>Unplanned Events</h3>
        <div id="unplannedEventGrid" class="event-summary-grid"></div>
    </div>
    </div>

    `;
    $(document).ready(function() {
      function fetchEventCounts(start, end) {
          // Hide prompt text and show summary text
          $('#promptText').hide();
          $('#summaryText').show();
          
          fetch(`/eventCountsInRange?ovenId=${CurrentOvenName}&start=${start.toISOString()}&end=${end.toISOString()}`)
              .then(response => response.json())
              .then(data => {
                  console.log('Event counts:', data);
                  document.getElementById('totalEvents').innerText = data.total;
                  document.getElementById('plannedEvents').innerText = data.planned;
                  document.getElementById('unplannedEvents').innerText = data.unplanned;
                   // Fetch events within the date range and display in the grid
            fetchEventsInRange(start, end);
              })
              .catch(error => {
                  console.error('Error fetching event counts:', error);
              });
      }
      function fetchEventsInRange(start, end) {
        fetch(`/eventsInRange?ovenId=${CurrentOvenName}&start=${start.toISOString()}&end=${end.toISOString()}`)
          .then(response => response.json())
          .then(data => {
            console.log('Events in range:', data);
            displayEventSummaries(data);
          })
          .catch(error => {
            console.error('Error fetching events in range:', error);
          });
      }
    
      function extractSummary(notes) {
        const summaryIndex = notes.toLowerCase().indexOf('summary');
        return summaryIndex !== -1 ? notes.substring(summaryIndex + 7).trim() : 'No summary found';
      }
    
      function displayEventSummaries(events) {
        const plannedEventGrid = document.getElementById('plannedEventGrid');
        const unplannedEventGrid = document.getElementById('unplannedEventGrid');
        plannedEventGrid.innerHTML = '';
        unplannedEventGrid.innerHTML = '';
        
        events.forEach(event => {
            const summary = extractSummary(event.notes);
            const eventColor = getEventColor(event.title);
            const eventItem = document.createElement('div');
            eventItem.classList.add('event-summary-item');
            eventItem.innerHTML = `
                <p><strong>Title:</strong> ${event.title}</p>
                <p><strong>Start:</strong> ${new Date(event.start).toLocaleString()}</p>
                <p><strong>End:</strong> ${new Date(event.end).toLocaleString()}</p>
                <p><strong>Summary:</strong> ${summary}</p>
            `;
    
            if (event.title.toLowerCase().startsWith('planned')) {
                plannedEventGrid.appendChild(eventItem);
            } else if (event.title.toLowerCase().startsWith('unplanned')) {
                unplannedEventGrid.appendChild(eventItem);
            }
        });
    }
      $('#daterange').daterangepicker({
          opens: 'left',
      }, function(start, end) {
          // Update the input with the selected date range
          $('#daterange').val(start.format('YYYY-MM-DD') + ' - ' + end.format('YYYY-MM-DD'));
          fetchEventCounts(start, end);
      });

      // Trigger event manually for initial load
      const initialStart = moment().startOf('day');
      const initialEnd = moment().endOf('day');
      fetchEventCounts(initialStart, initialEnd);
  });


  // Event handling code
  async function fetchEvents(ovenId) {
    try {
      const response = await fetch(`/events?ovenId=${ovenId}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async function createEvent(event) {
    console.log('Creating event:', event); // Log the event data
    try {
      const response = await fetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create event');
      }
      return responseData;
    } catch (error) {
      console.error('Error creating event:', error);
    }
  }
  
  async function updateEvent(event) {
    try {
      const response = await fetch(`/events/${event.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  }
  
  async function deleteEvent(eventId) {
    try {
      const response = await fetch(`/events/${eventId}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  }

  function getEventColor(title) {
    const firstWord = title.split(' ')[0].toLowerCase();
    switch (firstWord) {
      case 'planned':
        return '#d8eaf9';
      case 'unplanned':
        return '#ffc0cbad';
      default:
        return '#d3d3d373'; // Default color for events without specified first word
    }
  }
  // Initialize calendar
  const calendarEl = document.getElementById('calendar');
  const events = await fetchEvents(CurrentOvenName); // Fetch events for the selected oven

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    editable: true,
    events: events,
    eventClick: function(info) {
      openModal(info.event);
      calendar.refetchEvents();
    },
    eventDrop: async function(info) {
      const event = info.event;
      const updatedEvent = {
      eventId: event.extendedProps.eventId,
        title: event.title,
        notes: event.extendedProps.notes,
        start: event.start,
        end: event.end,
        ovenId: CurrentOvenName // Include ovenId
      };
      await updateEvent(updatedEvent);
    },
    eventResize: async function(info) {
      const event = info.event;
      const updatedEvent = {
      eventId: event.extendedProps.eventId,
        title: event.title,
        notes: event.extendedProps.notes,
        start: event.start,
        end: event.end,
        ovenId: CurrentOvenName // Include ovenId
      };
      await updateEvent(updatedEvent);
      calendar.refetchEvents(); // Refresh calendar to reflect changes
    },
    selectable: true,
    select: function(info) {
      selectedRange = info;
      openModal();
    },
    height: '100%',
    aspectRatio: 1.5,
    eventDidMount: function(arg) {
      const eventColor = getEventColor(arg.event.title);
      arg.el.style.backgroundColor = eventColor;
      arg.el.style.color = '#000000'; // Explicitly set text color to black
    }
  });

  calendar.render();

  const eventModal = document.getElementById('eventModal');
  const closeModal = document.querySelector('.close');
  const saveButton = document.querySelector('.save');
  const cancelButton = document.querySelector('.cancel');
  const deleteButton = document.querySelector('.delete');
  const eventTitleInput = document.getElementById('eventTitle');
  const eventNotesInput = document.getElementById('eventNotes');
  let currentEvent = null;

  function openModal(event = null) {
    currentEvent = event;
    eventTitleInput.value = event ? event.title : '';
    eventNotesInput.value = event ? event.extendedProps.notes : '';
    deleteButton.style.display = event ? 'inline-block' : 'none';
    eventModal.style.display = 'flex';
  }

  function closeModalFunc() {
    eventModal.style.display = 'none';
  }

  closeModal.onclick = closeModalFunc;
  cancelButton.onclick = closeModalFunc;
  window.onclick = function(event) {
    if (event.target == eventModal) {
      closeModalFunc();
    }
  }

// Inside the save button click handler
// Save button click handler
saveButton.onclick = async function() {
  if (currentEvent) {
    currentEvent.setProp('title', eventTitleInput.value);
    currentEvent.setExtendedProp('notes', eventNotesInput.value);
    const updatedEvent = {
      eventId: currentEvent.extendedProps.eventId,
      title: currentEvent.title,
      notes: currentEvent.extendedProps.notes,
      start: currentEvent.start.toISOString(),
      end: currentEvent.end ? currentEvent.end.toISOString() : null,
      ovenId: currentEvent.extendedProps.ovenId
    };
    // Update event color
    await updateEvent(updatedEvent);
  } else {
    const newEvent = {
      title: eventTitleInput.value,
      notes: eventNotesInput.value,
      start: selectedRange.start.toISOString(),
      end: selectedRange.end ? selectedRange.end.toISOString() : null,
      ovenId: CurrentOvenName // Include ovenId
    };
    const createdEvent = await createEvent(newEvent);
    if (createdEvent) {
      calendar.addEvent(createdEvent);
    }
  }
  closeModalFunc();
  calendar.refetchEvents(); // Refetch events to update colors

}


// Delete button click handler
deleteButton.onclick = async function() {
  if (currentEvent && confirm('Are you sure you want to delete this event?')) {
    await deleteEvent(currentEvent.extendedProps.eventId);
    currentEvent.remove();
    closeModalFunc();
  }
}
}}

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
          const activeID = document.querySelector('#runNumber')?.innerText;
          if (oven instanceof Element) {
            console.log("Und",oven)
            const ovenIdTemp = oven.firstChild.innerHTML
            fetchOvenData(ovenIdTemp, type, option, boardNumber, activeID);
          }
          else{          
            console.log("Defiend",oven)
            fetchOvenData(oven.name, type, option, boardNumber, activeID);}
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
      const { ovenId, temperature } = message.data;
      // Update the temperature data for the corresponding oven
      currentOven = document.querySelector('.selected-list').firstChild.innerHTML;
      currentTab = document.querySelector('.view-active').innerHTML
      tempData[ovenId] = Math.trunc(temperature);
      document.getElementById(`temp-${ovenId}`).innerText = tempData[ovenId];
      if (currentOven === ovenId && currentTab === 'Overview') {
        document.getElementById('main-temp').innerText = `${tempData[ovenId]}°C`;
      } else {
        if (currentTab === 'Tool Monitoring') {
        currentType = document.querySelector('#drop3 .selected').innerText;
        currentOption = document.querySelector('#drop4 .selected').innerText;
        currentBoard = document.querySelector('#drop5 .selected')?.innerText;
        if (currentOven && currentOven === message.data.ovenId) {
          if (currentType === 'Board' && currentBoard && currentBoard !== message.data.boardId) {
            console.log(`skipping data for board ${message.data.boardId} as it does not match the current board ${currentBoard}`);
            return;
          }
          chartData.unshift(message.data);
          updateChartData(chartData, currentType, currentOption, currentBoard);
        }}
      }
    } else if (message.type === 'statusUpdate') {
      console.log('Oven status updated:', message.data);
      const { ovenName, status, timestamp } = message.data;
      updateOvenStatus(ovenName, status, timestamp);
    }
  });
});
