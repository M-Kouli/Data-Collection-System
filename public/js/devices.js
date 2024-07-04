document.addEventListener('DOMContentLoaded', async () => {
    const ovenContainer = document.getElementById('oven-container');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const viewFrameName = document.querySelector('.view-header-name');
    let ovens = [];
    let selectedOven = null;

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
          <span>Utilisation Rate</span>
          <div class="percent-display">
            <h2><span>0</span>%</h2>
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
            });

            ovenContainer.appendChild(ovenDiv);
        });
    }
    // Function to update the .view-frame with selected oven information
    function updateViewFrame(oven) {
        viewFrameName.innerHTML = `
      <h2>${oven.name}</h2>
      <span class="dot"></span>
      <p>Active: 0s</p>
    `;
    }

    // Filter ovens based on search query and selected category
    function filterOvens() {
        const searchQuery = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.querySelector('.active').dataset.category;
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
            categoryFilter.querySelector('.active').classList.remove('active');
            event.target.classList.add('active');
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
    }
  });
});




const dropdown = document.querySelector(".dropdown");
const select = dropdown.querySelector(".select");
const caret = dropdown.querySelector(".caret");
const menu = dropdown.querySelector(".menu");
const options = dropdown.querySelectorAll(".menu li");
const selected = dropdown.querySelector(".selected");
select.addEventListener("click", () => {
    select.classList.toggle("select-clicked");
    caret.classList.toggle("caret-rotate");
    menu.classList.toggle("menu-open")
})
options.forEach(option => {
    option.addEventListener("click", () => {
        selected.innerText = option.innerText;
        select.classList.remove("select-clicked");
        caret.classList.remove("caret-rotate");
        menu.classList.remove("menu-open");
        options.forEach(option => {
            option.classList.remove("active")
        })
        option.classList.add("active")
    })
})