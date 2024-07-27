document.addEventListener('DOMContentLoaded', async () => {
    const ovenDropdown = document.getElementById('ovenDropdown');
    const runsContainer = document.getElementById('runsContainer');
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
      ovenDropdown.innerHTML = '<option value="">Select an oven</option>';
      ovens.forEach(oven => {
        const option = document.createElement('option');
        option.value = oven.name;
        option.textContent = oven.name;
        ovenDropdown.appendChild(option);
      });
    }
  
    // Fetch runs for the selected oven
    async function fetchRuns(ovenName) {
      try {
        const response = await fetch(`/ovenRuns?ovenName=${ovenName}`);
        const data = await response.json();
        runsContainer.innerHTML = `${data.highestActiveID}`;
      } catch (error) {
        console.error('Error fetching runs:', error);
      }
    }
  
    // // List runs and add download buttons
    // function listRuns(runs, ovenName) {
    //   runsContainer.innerHTML = '';
    //   runs.forEach(run => {
    //     const runDiv = document.createElement('div');
    //     runDiv.classList.add('run-item');
    //     runDiv.innerHTML = `
    //       <span>Run ID: ${run.activeID}</span>
    //       <button onclick="downloadExcel('${run.activeID}', '${ovenName}')">Download Excel</button>
    //     `;
    //     runsContainer.appendChild(runDiv);
    //   });
    // }
  
    // Download Excel sheet for a specific run
    async function downloadExcel(activeID, ovenName) {
      try {
        const response = await fetch(`/downloadExcel?activeID=${activeID}&ovenName=${ovenName}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `run_${activeID}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading Excel file:', error);
      }
    }
  
    // Event listener for oven selection
    ovenDropdown.addEventListener('change', (event) => {
      const selectedOven = event.target.value;
      if (selectedOven) {
        fetchRuns(selectedOven);
      } else {
        runsContainer.innerHTML = '';
      }
    });
  
    fetchOvens();
  });
  
  // Make the downloadExcel function globally accessible
  window.downloadExcel = downloadExcel;