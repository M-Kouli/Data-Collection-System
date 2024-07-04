document.addEventListener('DOMContentLoaded', async () => {
  const ovenContainer = document.getElementById('oven-container');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const viewFrameName = document.querySelector('.view-header-name');
  const viewmain = document.querySelector('.view-main');
  const viewFilter = document.getElementById("viewFilter");
  let viewFilterOption = viewFilter.querySelector('.view-active').dataset.category;
  console.log(viewFilterOption)
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
        SelectedView(oven);
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
          <span>Oven Temprature</span>
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
      <p>${ovens.indexOf(oven)+1} of ${ovens.length} </p>
      <i class='bx bx-chevron-right' id="nav-arrow-right"></i>
      </div>
    `;
  }


  function SelectedView(oven) {
    if(viewFilterOption === 'Overview'){
    viewmain.innerHTML = `
              <div class="main-filter">
            <div class="dropdown" id="drop2">
              <div class="select">
                <span class="selected">Last 7 Days</span>
                <div class="caret"></div>
              </div>
              <ul class="menu">
                <li data-category="All" class="active">Last 7 Days</li>
                <li data-category="E Series">Last Month</li>
                <li data-category="C Series">Last 6 Months</li>
                <li data-category="Schlumberger">Last Year</li>
              </ul>
            </div>
          </div>
          <div class="main-sec1">
            <div class="main-sec1-header">
              <div class="main-sec1-cards view-active">
                <p>Oven Temprature</p>
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
    `
  }
  else{
     viewmain.innerHTML = `<h2>TOOL</h2>`
  }
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




const dropdown = document.getElementById("drop1");
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

const viewOptions = document.querySelectorAll(".view-option");
viewOptions.forEach(viewOption => {
  viewOption.addEventListener("click", () => {
    viewOptions.forEach(viewOption => {
      viewOption.classList.remove("view-active")
    })
    viewOption.classList.add("view-active")
  })
})

const dropdown1 = document.getElementById("drop2");
const select1 = dropdown1.querySelector(".select");
const caret1 = dropdown1.querySelector(".caret");
const menu1 = dropdown1.querySelector(".menu");
const options1 = dropdown1.querySelectorAll(".menu li");
const selected1 = dropdown1.querySelector(".selected");
select1.addEventListener("click", () => {
  select1.classList.toggle("select-clicked");
  caret1.classList.toggle("caret-rotate");
  menu1.classList.toggle("menu-open")
})
options1.forEach(option1 => {
  option1.addEventListener("click", () => {
    selected1.innerText = option1.innerText;
    select1.classList.remove("select-clicked");
    caret1.classList.remove("caret-rotate");
    menu1.classList.remove("menu-open");
    options1.forEach(option1 => {
      option1.classList.remove("active")
    })
    option1.classList.add("active")
  })
})


