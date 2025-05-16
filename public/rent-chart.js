const HUD_API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI2IiwianRpIjoiODdkNjJjODNjYmNmMTRkZWEzMTZhNzE5OGQ3MmY1YzE0ZWViMjQyMTJlZWI3ZTcwYjhmZTFjMjlkMzA1YWJhMDQ5MGM1M2Q0ODlhOWU3NDMiLCJpYXQiOjE3NDU1OTc3ODYuNDI5MzczLCJuYmYiOjE3NDU1OTc3ODYuNDI5Mzc1LCJleHAiOjIwNjExMzA1ODYuNDIxNzk3LCJzdWIiOiI5NjUxOSIsInNjb3BlcyI6W119.ZfUECoLQ80NaT_NOxAZ5fWdkFjNCIgWpUwC-P0U_CJVwua4QNNltL3o2ZxrtWrmsGtnHM6lznN2X4eWQ_wOoAQ";

let swiperInstance = null;
let chartInstances = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCounties();
    document.getElementById('countySelect').addEventListener('change', fetchFMRData);
});

async function loadCounties() {
    const url = `https://www.huduser.gov/hudapi/public/fmr/listCounties/MD`;
    try {
        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${HUD_API_TOKEN}`,
                "Accept": "application/json"
            }
        });
        const data = await res.json();
        const countySelect = document.getElementById("countySelect");
        data.forEach(element => {
            countySelect.innerHTML += `<option value="${element.fips_code}">${element.county_name}</option>`;
        });
        document.getElementById("countyHolder").innerHTML = "Please Select a County";
    } catch (err) {
        console.error("County fetch failed:", err);
    }
}

async function fetchFMRData() {
    const fips = document.getElementById("countySelect").value;
    const resultBox = document.getElementById("fmrResults");
    resultBox.innerHTML = `<p class="text-muted">Loading rent data...</p>`;
    if (!fips) return;

    const url = `https://www.huduser.gov/hudapi/public/fmr/data/${fips}`;
    try {
        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${HUD_API_TOKEN}`,
                "Accept": "application/json"
            }
        });
        const result = await res.json();
        const rentData = result.data.basicdata;
        resultBox.innerHTML = '';

        // Clear previous charts
        chartInstances.forEach(chart => chart.destroy());
        chartInstances = [];

        if (Array.isArray(rentData)) {
            // Chunk ZIPs into groups of 4
            const zipGroups = chunkArray(
                rentData.filter(zipInfo => zipInfo.zip_code && zipInfo.zip_code !== "MSA level"),
                4
            );

            // Build Swiper slides with canvases
            const swiperWrapper = document.getElementById("swiper-wrapper");
            swiperWrapper.innerHTML = ""; // clear old slides

            zipGroups.forEach((group, idx) => {
                const slide = document.createElement("div");
                slide.className = "swiper-slide";
                const canvasId = `rentChart${idx}`;
                slide.innerHTML = `<canvas id="${canvasId}" width="800" height="400"></canvas>`;
                swiperWrapper.appendChild(slide);
            });

            // Wait for DOM to update
            setTimeout(() => {
                zipGroups.forEach((group, idx) => {
                    const canvasId = `rentChart${idx}`;
                    const ctx = document.getElementById(canvasId).getContext('2d');
                    const zipCodes = group.map(z => z.zip_code);
                    const efficiency = group.map(z => z.Efficiency || null);
                    const oneBed = group.map(z => z["One-Bedroom"] || null);
                    const twoBed = group.map(z => z["Two-Bedroom"] || null);
                    const threeBed = group.map(z => z["Three-Bedroom"] || null);
                    const fourBed = group.map(z => z["Four-Bedroom"] || null);

                    const chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: zipCodes,
                            datasets: [
                                { label: 'Efficiency', data: efficiency, backgroundColor: '#a3a3ff' },
                                { label: '1 Bedroom', data: oneBed, backgroundColor: '#ffb3c6' },
                                { label: '2 Bedroom', data: twoBed, backgroundColor: '#baffc9' },
                                { label: '3 Bedroom', data: threeBed, backgroundColor: '#ffd6a5' },
                                { label: '4 Bedroom', data: fourBed, backgroundColor: '#fdffb6' }
                            ]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { display: true },
                                tooltip: { enabled: true }
                            },
                            scales: {
                                x: { stacked: false, title: { display: true, text: 'ZIP Code' } },
                                y: { beginAtZero: true, title: { display: true, text: 'Monthly Rent ($)' } }
                            }
                        }
                    });
                    chartInstances.push(chart);
                });

                // Initialize or update Swiper
                if (swiperInstance) {
                    swiperInstance.update();
                    swiperInstance.slideTo(0);
                } else {
                  swiperInstance = new Swiper('.swiper', {
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                        dynamicBullets: true, 
                    },
                    loop: false,
                    slidesPerView: 1,
                    centeredSlides: true,
                    spaceBetween: 30,
                    autoplay: {
                        delay: 3000, 
                        disableOnInteraction: false,
                    }
                });
                
                }
            }, 100);

            const zipSelect = document.createElement('select');
            zipSelect.className = 'form-select my-3';
            zipSelect.innerHTML = `<option value="">Select a ZIP Code</option>`;

            const rentMap = {};
            rentData.forEach(zipInfo => {
                if (zipInfo.zip_code && zipInfo.zip_code !== "MSA level") {
                    rentMap[zipInfo.zip_code] = zipInfo;
                    zipSelect.innerHTML += `<option value="${zipInfo.zip_code}">${zipInfo.zip_code}</option>`;
                }
            });

            resultBox.appendChild(zipSelect);

            const zipDetails = document.createElement('div');
            zipDetails.id = 'zipDetails';
            resultBox.appendChild(zipDetails);

            zipSelect.addEventListener('change', () => {
                const selectedZip = zipSelect.value;
                const rents = rentMap[selectedZip];
                if (rents) {
                    zipDetails.innerHTML = `
                        <h5>Fair Market Rents for ZIP ${selectedZip}</h5>
                        <ul class="list-group">
                            <li class="list-group-item">Efficiency: $${rents.Efficiency}</li>
                            <li class="list-group-item">1 Bedroom: $${rents["One-Bedroom"]}</li>
                            <li class="list-group-item">2 Bedroom: $${rents["Two-Bedroom"]}</li>
                            <li class="list-group-item">3 Bedroom: $${rents["Three-Bedroom"]}</li>
                            <li class="list-group-item">4 Bedroom: $${rents["Four-Bedroom"]}</li>
                        </ul>
                    `;
                } else {
                    zipDetails.innerHTML = '';
                }
            });

        } else {
            chartInstances.forEach(chart => chart.destroy());
            chartInstances = [];
            const swiperWrapper = document.getElementById("swiper-wrapper");
            swiperWrapper.innerHTML = `<div class="swiper-slide"><canvas id="rentChartSingle" width="800" height="400"></canvas></div>`;
            setTimeout(() => {
                const ctx = document.getElementById('rentChartSingle').getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['County'],
                        datasets: [
                            { label: 'Efficiency', data: [rentData.Efficiency], backgroundColor: '#a3a3ff' },
                            { label: '1 Bedroom', data: [rentData["One-Bedroom"]], backgroundColor: '#ffb3c6' },
                            { label: '2 Bedroom', data: [rentData["Two-Bedroom"]], backgroundColor: '#baffc9' },
                            { label: '3 Bedroom', data: [rentData["Three-Bedroom"]], backgroundColor: '#ffd6a5' },
                            { label: '4 Bedroom', data: [rentData["Four-Bedroom"]], backgroundColor: '#fdffb6' }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: true },
                            tooltip: { enabled: true }
                        },
                        scales: {
                            x: { stacked: false, title: { display: true, text: 'County' } },
                            y: { beginAtZero: true, title: { display: true, text: 'Monthly Rent ($)' } }
                        }
                    }
                });
                chartInstances.push(chart);

                if (swiperInstance) {
                    swiperInstance.update();
                    swiperInstance.slideTo(0);
                } else {
                    swiperInstance = new Swiper('.swiper', {
                        navigation: {
                            nextEl: '.swiper-button-next',
                            prevEl: '.swiper-button-prev',
                        },
                        pagination: {
                            el: '.swiper-pagination',
                            clickable: true,
                        },
                        loop: false,
                        slidesPerView: 1,
                        centeredSlides: true,
                        spaceBetween: 30
                    });
                }
            }, 100);

            resultBox.innerHTML = `
                <h5>Fair Market Rents</h5>
                <ul class="list-group">
                    <li class="list-group-item">Efficiency: $${rentData.Efficiency}</li>
                    <li class="list-group-item">1 Bedroom: $${rentData["One-Bedroom"]}</li>
                    <li class="list-group-item">2 Bedroom: $${rentData["Two-Bedroom"]}</li>
                    <li class="list-group-item">3 Bedroom: $${rentData["Three-Bedroom"]}</li>
                    <li class="list-group-item">4 Bedroom: $${rentData["Four-Bedroom"]}</li>
                </ul>
            `;
        }

    } catch (err) {
        console.error("FMR fetch failed:", err);
        resultBox.innerHTML = `<p class="text-danger">Failed to load rent data ðŸ’¥</p>`;
        chartInstances.forEach(chart => chart.destroy());
        chartInstances = [];
    }
}

function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}