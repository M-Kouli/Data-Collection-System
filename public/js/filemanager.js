document.addEventListener('DOMContentLoaded', async () => {
  const drop6 = document.getElementById('drop6');
  const selectedSpan = drop6.querySelector('.selected');
  const menu = drop6.querySelector('.menu');
  const runsContainer = document.getElementById('runsContainer');
  const daterange = document.getElementById('daterange');
  let ovens = [];

  // Fetch ovens on page load
  async function fetchOvens() {
    try {
      const response = await fetch('/ovens');
      ovens = await response.json();
      populateOvenDropdown(ovens);
    } catch (error) {
      console.error('Error fetching ovens:', error);
    }
  }

  // Populate the oven dropdown
  function populateOvenDropdown(ovens) {
    menu.innerHTML = '<li data-category="" class="active-menu">Select an oven</li>';
    runsContainer.innerHTML = '<p style="padding: 0em 1em;">Select an oven first.</p>';
    ovens.forEach(oven => {
      const li = document.createElement('li');
      li.textContent = oven.name;
      li.setAttribute('data-category', oven.name);
      menu.appendChild(li);
    });

    // Add event listeners to the new menu items
    setupDropdownEventListeners('drop6', ovens);
  }

  // Fetch the highest activeID for the selected oven
  async function fetchHighestActiveID(ovenName) {
    try {
      const response = await fetch(`/highestActiveID?ovenName=${ovenName}`);
      const data = await response.json();
      const highestActiveID = data.highestActiveID;
      createRunButtons(highestActiveID, ovenName);
    } catch (error) {
      console.error('Error fetching highest activeID:', error);
    }
  }

  // Function to format timestamp to "MM/DD/YYYY"
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // Function to fetch and display first and last run timestamps
  async function fetchRunTimestamps(ovenName) {
    try {
      const firstRunResponse = await fetch(`/downloadExcel?ovenName=${ovenName}&activeID=1`);
      const firstRunData = await firstRunResponse.json();
      const lastRunResponse = await fetch(`/highestActiveID?ovenName=${ovenName}`);
      const lastRunData = await lastRunResponse.json();
      const highestActiveID = lastRunData.highestActiveID;
      const lastRunEntriesResponse = await fetch(`/downloadExcel?ovenName=${ovenName}&activeID=${highestActiveID}`);
      const lastRunEntriesData = await lastRunEntriesResponse.json();

      const firstRunFirstEntryTimestamp = firstRunData.length > 0 ? firstRunData[0].timestamp : 'No data';
      const lastRunFirstEntryTimestamp = lastRunEntriesData.length > 0 ? lastRunEntriesData[0].timestamp : 'No data';
      if (firstRunFirstEntryTimestamp === 'No data' || lastRunFirstEntryTimestamp === 'No data') {
        runsContainer.innerHTML = '<p style="padding: 0em 1em;">No runs found for this oven.</p>';
        return;
      } else {
        const formattedFirstRunTimestamp = formatDate(firstRunFirstEntryTimestamp);
        const formattedLastRunTimestamp = formatDate(lastRunFirstEntryTimestamp);

        console.log(`First run first entry timestamp: ${formattedFirstRunTimestamp}`);
        console.log(`Last run first entry timestamp: ${formattedLastRunTimestamp}`);

        // Update the date range picker without reinitializing it, using JQuery for the daterange picker
        $('input[name="daterange"]').data('daterangepicker').setStartDate(formattedFirstRunTimestamp);
        $('input[name="daterange"]').data('daterangepicker').setEndDate(formattedLastRunTimestamp);
        filterRunsByDateRange($('input[name="daterange"]').data('daterangepicker').startDate, $('input[name="daterange"]').data('daterangepicker').endDate);
      }

    } catch (error) {
      console.error('Error fetching run timestamps:', error);
    }
  }

  // Initialize the date range picker once
  $(function() {
    $('input[name="daterange"]').daterangepicker({
      opens: 'right'
    }, function(start, end, label) {
      console.log("A new date selection was made: " + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD'));
      filterRunsByDateRange(start, end);
    });
  });

  // Function to filter and show active runs based on the selected date range
  async function filterRunsByDateRange(start, end) {
    const selectedOven = document.querySelector('#drop6 .selected').innerText;
    if (selectedOven === 'Select an oven' || selectedOven === '') return;

    try {
      const response = await fetch(`/getOvenData?ovenName=${selectedOven}`);
      const data = await response.json();

      const filteredRuns = data.filter(run => {
        const runStartDate = new Date(run.entries[0].timestamp);
        return runStartDate >= start.toDate() && runStartDate <= end.toDate();
      });

      displayFilteredRuns(filteredRuns);
    } catch (error) {
      console.error('Error filtering runs by date range:', error);
    }
  }

  function checkOutliers(data) {
    let boardsWithOutliers = {};
  
    data.forEach(d => {
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
    console.log(boardsWithOutliers); // Log of boards with exceeded limits and parameters
    return { boardsWithOutliers };
  }
  
  function displayFilteredRuns(runs) {
    console.log(runs);
    if (runs.length === 0) {
      runsContainer.innerHTML = '<p style="padding: 0em 1em;">No runs found for the selected date range.</p>';
      return;
    } else {
      runsContainer.innerHTML = '';
      const table = document.createElement('table');
      table.setAttribute('id', 'tableRuns');
      table.setAttribute('class', 'table table-striped table-bordered');
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');
      thead.innerHTML = `
        <tr>
          <th>Run Number</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Total Boards</th>
          <th>Boards Passed</th>
          <th>Boards Failed</th>
          <th>Pass Rate</th>
          <th>Download</th>
        </tr>
      `;
      table.appendChild(thead);
      table.appendChild(tbody);
  
      // Initialize counters for summary row
      let totalRuns = 0;
      let sumTotalBoards = 0;
      let sumPassedBoards = 0;
      let sumFailedBoards = 0;
  
      runs.forEach(run => {
        const row = document.createElement('tr');
        const startTimestamp = run.entries.length > 0 ? formatDate(run.entries[0].timestamp) : 'No data';
        const endTimestamp = run.entries.length > 0 ? formatDate(run.entries[run.entries.length - 1].timestamp) : 'No data';
  
        // Check outliers for the current run
        const { boardsWithOutliers } = checkOutliers(run.entries);
        const totalBoards = Object.keys(boardsWithOutliers).length;
        const failedBoards = Object.values(boardsWithOutliers).filter(board => board.totalFails > 0).length;
        const passedBoards = totalBoards - failedBoards;
        const passRate = totalBoards === 0 ? 'N/A' : ((passedBoards / totalBoards) * 100).toFixed(2) + '%';
  
        // Update counters for summary row
        totalRuns++;
        sumTotalBoards += totalBoards;
        sumPassedBoards += passedBoards;
        sumFailedBoards += failedBoards;
  
        row.innerHTML = `
          <td>Run ${run.activeID}</td>
          <td>${startTimestamp}</td>
          <td>${endTimestamp}</td>
          <td>${totalBoards}</td>
          <td>${passedBoards}</td>
          <td>${failedBoards}</td>
          <td>${passRate}</td>
          <td><button id="download-${run.activeID}">Download</button></td>
        `;
        row.querySelector(`#download-${run.activeID}`).addEventListener('click', () => downloadRunData(document.querySelector('#drop6 .selected').innerText, run.activeID));
        tbody.appendChild(row);
      });
  
      runsContainer.appendChild(table);
  
      // Initialize DataTables
      $(document).ready(function() {
        $('#tableRuns').DataTable();
      });
  
      // Calculate the overall pass rate
      const overallPassRate = sumTotalBoards === 0 ? 'N/A' : ((sumPassedBoards / sumTotalBoards) * 100).toFixed(2) + '%';
  
      // Add summary row after DataTables initialization
      const summaryRow = document.createElement('tr');
      summaryRow.innerHTML = `
        <td colspan="3"><strong>Summary</strong></td>
        <td><strong>${sumTotalBoards}</strong></td>
        <td><strong>${sumPassedBoards}</strong></td>
        <td><strong>${sumFailedBoards}</strong></td>
        <td><strong>${overallPassRate}</strong></td>
        <td></td>
      `;
      // Append summary row directly to the table without DataTables processing it
      table.appendChild(summaryRow);
    }
  }
  
  

  // Create buttons for each run
  function createRunButtons(highestActiveID, ovenName) {
    runsContainer.innerHTML = '';
    // for (let i = 1; i <= highestActiveID; i++) {
    //   const button = document.createElement('button');
    //   button.textContent = `Download Run ${i}`;
    //   button.addEventListener('click', () => downloadRunData(ovenName, i));
    //   runsContainer.appendChild(button);
    // }
  }

  // Function to download run data
  async function downloadRunData(ovenName, activeID) {
    try {
      const response = await fetch(`/downloadExcel?ovenName=${ovenName}&activeID=${activeID}`);
      const data = await response.json();
      createExcelFile(data, ovenName, activeID);
    } catch (error) {
      console.error('Error downloading run data:', error);
    }
  }

  // Function to create and download Excel file
  function createExcelFile(data, ovenName, activeID) {
    const workbook = XLSX.utils.book_new();

    // Separate oven and board data
    const ovenData = data.filter(entry => entry.dataType === 'Oven').map(entry => ({
      timestamp: entry.timestamp,
      temperature: entry.temperature,
      temperatureUpperControlLimit: entry.temperatureUpperControlLimit,
      temperatureLowerControlLimit: entry.temperatureLowerControlLimit,
    }));

    if (ovenData.length > 0) {
      const ovenSheet = XLSX.utils.json_to_sheet(ovenData);
      XLSX.utils.book_append_sheet(workbook, ovenSheet, 'Oven');
    }

    const boardData = data.filter(entry => entry.dataType === 'Board');
    const boards = [...new Set(boardData.map(entry => entry.boardId))];

    boards.forEach(boardId => {
      const boardEntries = boardData.filter(entry => entry.boardId === boardId).map(entry => ({
        timestamp: entry.timestamp,
        p1: entry.p1,
        p1UpperControlLimit: entry.p1UpperControlLimit,
        p1LowerControlLimit: entry.p1LowerControlLimit,
        p2: entry.p2,
        p2UpperControlLimit: entry.p2UpperControlLimit,
        p2LowerControlLimit: entry.p2LowerControlLimit,
        t1: entry.t1,
        t1UpperControlLimit: entry.t1UpperControlLimit,
        t1LowerControlLimit: entry.t1LowerControlLimit,
        t2: entry.t2,
        t2UpperControlLimit: entry.t2UpperControlLimit,
        t2LowerControlLimit: entry.t2LowerControlLimit,
        vx: entry.vx,
        vxUpperControlLimit: entry.vxUpperControlLimit,
        vxLowerControlLimit: entry.vxLowerControlLimit,
        vz: entry.vz,
        vzUpperControlLimit: entry.vzUpperControlLimit,
        vzLowerControlLimit: entry.vzLowerControlLimit,
        ct: entry.ct,
        ctUpperControlLimit: entry.ctUpperControlLimit,
        ctLowerControlLimit: entry.ctLowerControlLimit,
        vt: entry.vt,
        vtUpperControlLimit: entry.vtUpperControlLimit,
        vtLowerControlLimit: entry.vtLowerControlLimit,
      }));

      if (boardEntries.length > 0) {
        const boardSheet = XLSX.utils.json_to_sheet(boardEntries);
        XLSX.utils.book_append_sheet(workbook, boardSheet, `Board_${boardId}`);
      }
    });

    // Generate Excel file and trigger download
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ovenName}_run_${activeID}_data.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF;
    }
    return buf;
  }

  // Set up dropdown event listeners
  function setupDropdownEventListeners(dropdownId, ovens) {
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
        const selectedOven = option.getAttribute('data-category');
        if (selectedOven) {
          fetchHighestActiveID(selectedOven);
          fetchRunTimestamps(selectedOven);
        } else {
          runsContainer.innerHTML = '<p style="padding: 0em 1em;">Select an oven first.</p>';
        }
      });
    });
  }

  fetchOvens();
});
