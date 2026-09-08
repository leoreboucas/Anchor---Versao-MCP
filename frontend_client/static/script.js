
/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const API_URL = "/api/status";
const POLLING_INTERVAL = 5000;

const state = {
    data: {
        responseCounts: [],
        respondents: [],
        scoreDistribution: [],
        scoreAverage: [],
        aggregateOverall: []
    },

    status: {
        responseCounts: "unavailable",
        respondents: "unavailable",
        scoreDistribution: "unavailable",
        scoreAverage: "unavailable",
        aggregateOverall: "unavailable"
    },

    lastValidData: {
        responseCounts: null,
        respondents: null,
        scoreDistribution: null,
        scoreAverage: null,
        aggregateOverall: null
    },

    charts: {},

    filters: {
        responsePeriod: "all",
        responseRegion: "all",
        responseCountry: "all",
        responseCategory: "all",

        respondentsPeriod: "all",
        respondentsRegion: "all",
        respondentsCountry: "all",
        respondentsDepartment: "all",

        distributionPeriod: "all",
        distributionRegion: "all",
        distributionCategory: "all",
        distributionSubcategory: "all",

        scoreRegion: "all",
        scoreCountry: "all",
        scoreCategory: "all",
        scoreSubcategory: "all"
    },

    lastUpdatedAt: null,
    isFirstLoad: true
};


/* =========================================================
   CONSTANTES VISUAIS
========================================================= */

const SCORE_OPTIONS_ORDER = [
    "Nunca",
    "Raramente",
    "Às vezes",
    "Frequentemente",
    "Sempre"
];

const SCORE_OPTION_COLORS = {
    "Nunca": "#a45e5e",
    "Raramente": "#c28b76",
    "Às vezes": "#b49a69",
    "Frequentemente": "#779477",
    "Sempre": "#4f8667"
};

const SCORE_BUCKET_ORDER = [
    "1-2",
    "2-3.5",
    "3.5-5"
];


/* =========================================================
   UTILITÁRIOS
========================================================= */

function toNumber(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}


function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(
        Math.round(toNumber(value))
    );
}


function formatDecimal(value, decimals = 2) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = toNumber(value);

    return number.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}


function formatSigned(value, decimals = 2) {
    const number = toNumber(value);

    if (number > 0) {
        return `+ ${ formatDecimal(number, decimals) } `;
    }

    return formatDecimal(number, decimals);
}


function normalizeText(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function uniqueSorted(values) {
    return [...new Set(
        values
            .filter(value => value !== null && value !== undefined)
            .map(value => String(value))
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));
}


function sortPeriods(periods) {
    return [...periods].sort((a, b) => {
        return String(a).localeCompare(String(b));
    });
}


function latestPeriod(data) {
    if (!Array.isArray(data) || !data.length) {
        return null;
    }

    const periods = data
        .map(item => item.period)
        .filter(Boolean);

    if (!periods.length) {
        return null;
    }

    return sortPeriods(uniqueSorted(periods)).at(-1);
}


function previousPeriod(data, currentPeriod) {
    const periods = sortPeriods(
        uniqueSorted(
            data
                .map(item => item.period)
                .filter(Boolean)
        )
    );

    const index = periods.indexOf(currentPeriod);

    if (index <= 0) {
        return null;
    }

    return periods[index - 1];
}


function sumBy(data, field) {
    return data.reduce(
        (total, item) => total + toNumber(item[field]),
        0
    );
}


function average(values) {
    const validValues = values
        .map(toNumber)
        .filter(value => Number.isFinite(value));

    if (!validValues.length) {
        return null;
    }

    return validValues.reduce((sum, value) => sum + value, 0)
        / validValues.length;
}


function groupBy(data, keyFunction) {
    const groups = new Map();

    data.forEach(item => {
        const key = keyFunction(item);

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(item);
    });

    return groups;
}


function getLatestItems(data) {
    const period = latestPeriod(data);

    if (!period) {
        return [];
    }

    return data.filter(item => item.period === period);
}


function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   API
========================================================= */

function extractDataset(source) {
    if (!source) {
        return {
            status: "unavailable",
            data: null,
            updatedAt: null
        };
    }

    /*
     * Formato esperado:
     *
     * {
     *     status: "ok",
     *     updated_at: "...",
     *     data: [...]
     * }
     */

    if (Array.isArray(source)) {
        return {
            status: "ok",
            data: source,
            updatedAt: null
        };
    }

    return {
        status: source.status || "unavailable",
        data: Array.isArray(source.data)
            ? source.data
            : null,
        updatedAt: source.updated_at || null
    };
}


async function fetchDashboardData() {
    const response = await fetch(API_URL, {
        method: "GET",
        cache: "no-store",
        headers: {
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(
            `Falha ao consultar dashboard: HTTP ${ response.status } `
        );
    }

    return response.json();
}


/* =========================================================
   PROCESSAMENTO DA RESPOSTA
========================================================= */

function processApiResponse(payload) {

    /*
     * Aceita os nomes atuais do Flask:
     *
     * raw_data
     * respondents
     * score_distribution
     * punctuation
     * aggregation
     *
     * E também os nomes equivalentes usados internamente.
     */

    const responseCountsSource =
        payload.response_counts ??
        payload.raw_data;

    const respondentsSource =
        payload.respondents;

    const distributionSource =
        payload.score_distribution;

    const scoreAverageSource =
        payload.score_average ??
        payload.punctuation;

    const aggregateSource =
        payload.aggregate_overall ??
        payload.aggregation;


    const datasets = {
        responseCounts: extractDataset(responseCountsSource),
        respondents: extractDataset(respondentsSource),
        scoreDistribution: extractDataset(distributionSource),
        scoreAverage: extractDataset(scoreAverageSource),
        aggregateOverall: extractDataset(aggregateSource)
    };


    const mapping = [
        "responseCounts",
        "respondents",
        "scoreDistribution",
        "scoreAverage",
        "aggregateOverall"
    ];


    mapping.forEach(key => {

        const source = datasets[key];

        state.status[key] = source.status;

        /*
         * Se recebeu dados válidos, atualiza o estado
         * e guarda uma cópia como último dado válido.
         */
        if (
            source.status === "ok" &&
            Array.isArray(source.data)
        ) {
            state.data[key] = source.data;
            state.lastValidData[key] = source.data;
        }

        /*
         * Se o serviço falhou, mantém os dados anteriores.
         * Isso evita apagar o dashboard durante uma falha
         * momentânea dos microsserviços.
         */
        else if (state.lastValidData[key]) {
            state.data[key] = state.lastValidData[key];
        }
        else {
            state.data[key] = [];
        }
    });


    const updatedDates = mapping
        .map(key => datasets[key].updatedAt)
        .filter(Boolean);

    if (updatedDates.length) {
        state.lastUpdatedAt = updatedDates
            .sort()
            .at(-1);
    }
}


/* =========================================================
   STATUS
========================================================= */

function statusLabel(status) {

    if (status === "ok") {
        return "Atualizado";
    }

    if (status === "error") {
        return "Instável";
    }

    return "Reconectando";
}


function applyStatus(elementId, status) {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.classList.remove(
        "status-ok",
        "status-error",
        "status-unavailable"
    );

    const className =
        status === "ok"
            ? "status-ok"
            : status === "error"
                ? "status-error"
                : "status-unavailable";

    element.classList.add(className);

    const text = element.querySelector(".status-text");

    if (text) {
        text.textContent = statusLabel(status);
    }
}


function updateSectionStatus(
    sectionId,
    statusId,
    status
) {
    const section = document.getElementById(sectionId);

    if (!section) {
        return;
    }

    section.classList.toggle(
        "data-stale",
        status !== "ok" && state.data[
            section.dataset.source === "raw_data"
                ? "responseCounts"
                : section.dataset.source === "respondents"
                    ? "respondents"
                    : section.dataset.source === "score_distribution"
                        ? "scoreDistribution"
                        : section.dataset.source === "punctuation"
                            ? "scoreAverage"
                            : "aggregateOverall"
        ].length > 0
    );

    applyStatus(statusId, status);
}


function updateAllStatuses() {

    updateSectionStatus(
        "response-counts-section",
        "response-counts-status",
        state.status.responseCounts
    );

    updateSectionStatus(
        "respondents-section",
        "respondents-status",
        state.status.respondents
    );

    updateSectionStatus(
        "score-distribution-section",
        "score-distribution-status",
        state.status.scoreDistribution
    );

    updateSectionStatus(
        "score-average-section",
        "score-average-status",
        state.status.scoreAverage
    );

    updateSectionStatus(
        "aggregate-section",
        "aggregate-status",
        state.status.aggregateOverall
    );


    const statuses = Object.values(state.status);

    const hasError = statuses.some(
        status => status === "error"
    );

    const hasUnavailable = statuses.some(
        status => status === "unavailable"
    );

    const globalIndicator =
        document.getElementById("global-status-indicator");

    const globalText =
        document.getElementById("global-status-text");

    const alert =
        document.getElementById("connection-alert");


    globalIndicator?.classList.remove(
        "status-ok",
        "status-error",
        "status-unavailable"
    );

    if (!hasError && !hasUnavailable) {

        globalIndicator?.classList.add("status-ok");

        if (globalText) {
            globalText.textContent = "Todos os serviços online";
        }

        if (alert) {
            alert.hidden = true;
        }

        return;
    }


    if (hasError) {

        globalIndicator?.classList.add("status-error");

        if (globalText) {
            globalText.textContent = "Conexão instável";
        }
    }

    else {

        globalIndicator?.classList.add("status-unavailable");

        if (globalText) {
            globalText.textContent = "Reconectando...";
        }
    }


    if (alert) {
        alert.hidden = false;
    }
}


/* =========================================================
   FILTROS GENÉRICOS
========================================================= */

function populateSelect(
    selectId,
    values,
    selectedValue = "all",
    allLabel = "Todos"
) {
    const select = document.getElementById(selectId);

    if (!select) {
        return;
    }

    const currentValue = selectedValue;

    select.innerHTML = "";

    const allOption = document.createElement("option");

    allOption.value = "all";
    allOption.textContent = allLabel;

    select.appendChild(allOption);


    uniqueSorted(values).forEach(value => {

        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });


    const availableValues = [
        ...select.options
    ].map(option => option.value);

    select.value = availableValues.includes(currentValue)
        ? currentValue
        : "all";
}


function getFilteredData(data, filters) {

    return data.filter(item => {

        if (
            filters.period &&
            filters.period !== "all" &&
            item.period !== filters.period
        ) {
            return false;
        }

        if (
            filters.region &&
            filters.region !== "all" &&
            item.region !== filters.region
        ) {
            return false;
        }

        if (
            filters.country &&
            filters.country !== "all" &&
            item.country !== filters.country
        ) {
            return false;
        }

        if (
            filters.category &&
            filters.category !== "all" &&
            item.category !== filters.category
        ) {
            return false;
        }

        if (
            filters.subcategory &&
            filters.subcategory !== "all" &&
            item.subcategory !== filters.subcategory
        ) {
            return false;
        }

        if (
            filters.department &&
            filters.department !== "all" &&
            item.department !== filters.department
        ) {
            return false;
        }

        return true;
    });
}


/* =========================================================
   01 — RESPONSE COUNTS
========================================================= */

function populateResponseFilters() {

    const data = state.data.responseCounts;

    populateSelect(
        "response-period-filter",
        data.map(item => item.period),
        state.filters.responsePeriod,
        "Todos os períodos"
    );

    populateSelect(
        "response-region-filter",
        data.map(item => item.region),
        state.filters.responseRegion,
        "Todas as regiões"
    );

    populateSelect(
        "response-country-filter",
        data.map(item => item.country),
        state.filters.responseCountry,
        "Todos os países"
    );

    populateSelect(
        "response-category-filter",
        data.map(item => item.category),
        state.filters.responseCategory,
        "Todas as categorias"
    );
}


function renderResponseCounts() {

    const data = getFilteredData(
        state.data.responseCounts,
        {
            period: state.filters.responsePeriod,
            region: state.filters.responseRegion,
            country: state.filters.responseCountry,
            category: state.filters.responseCategory
        }
    );


    const empty =
        document.getElementById("response-counts-empty");

    if (empty) {
        empty.hidden = data.length > 0;
    }


    if (!data.length) {
        clearChart("response-volume-chart");
        clearChart("response-options-chart");
        return;
    }


    const totalResponses = sumBy(
        data,
        "response_count"
    );


    const periods = sortPeriods(
        uniqueSorted(
            data.map(item => item.period)
        )
    );


    const latest = periods.at(-1);


    const categoryGroups = groupBy(
        data,
        item => item.category
    );


    const categoryTotals = [...categoryGroups.entries()]
        .map(([category, items]) => ({
            category,
            total: sumBy(items, "response_count")
        }))
        .sort((a, b) => b.total - a.total);


    setText(
        "response-total",
        formatNumber(totalResponses)
    );

    setText(
        "response-total-description",
        `${ formatNumber(data.length) } registros agregados`
    );

    setText(
        "response-latest-period",
        latest || "—"
    );

    setText(
        "response-top-category",
        categoryTotals[0]?.category || "—"
    );

    setText(
        "response-top-category-description",
        categoryTotals[0]
            ? `${ formatNumber(categoryTotals[0].total) } respostas`
            : "Aguardando dados"
    );


    /*
     * Evolução do volume
     */

    const periodTotals = periods.map(period => {

        const items = data.filter(
            item => item.period === period
        );

        return sumBy(items, "response_count");
    });


    renderChart(
        "response-volume-chart",
        {
            type: "line",

            data: {
                labels: periods,

                datasets: [{
                    label: "Respostas",
                    data: periodTotals,

                    borderColor: "#526581",
                    backgroundColor: "rgba(82, 101, 129, 0.08)",

                    fill: true,
                    tension: 0.35,

                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },

            options: baseLineOptions()
        }
    );


    /*
     * Distribuição por opção
     */

    const optionGroups = groupBy(
        data,
        item => item.option_label
    );


    const labels = SCORE_OPTIONS_ORDER.filter(
        option => optionGroups.has(option)
    );


    const fallbackLabels = [...optionGroups.keys()]
        .filter(option => !SCORE_OPTIONS_ORDER.includes(option));


    labels.push(...fallbackLabels);


    const optionValues = labels.map(
        option => sumBy(
            optionGroups.get(option) || [],
            "response_count"
        )
    );


    renderChart(
        "response-options-chart",
        {
            type: "bar",

            data: {
                labels,

                datasets: [{
                    label: "Respostas",

                    data: optionValues,

                    backgroundColor: labels.map(
                        label =>
                            SCORE_OPTION_COLORS[label]
                            || "#526581"
                    ),

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: baseBarOptions()
        }
    );
}


/* =========================================================
   02 — RESPONDENTS
========================================================= */

function populateRespondentFilters() {

    const data = state.data.respondents;

    populateSelect(
        "respondents-period-filter",
        data.map(item => item.period),
        state.filters.respondentsPeriod,
        "Todos os períodos"
    );

    populateSelect(
        "respondents-region-filter",
        data.map(item => item.region),
        state.filters.respondentsRegion,
        "Todas as regiões"
    );

    populateSelect(
        "respondents-country-filter",
        data.map(item => item.country),
        state.filters.respondentsCountry,
        "Todos os países"
    );

    populateSelect(
        "respondents-department-filter",
        data.map(item => item.department),
        state.filters.respondentsDepartment,
        "Todos os departamentos"
    );
}


function renderRespondents() {

    const data = getFilteredData(
        state.data.respondents,
        {
            period: state.filters.respondentsPeriod,
            region: state.filters.respondentsRegion,
            country: state.filters.respondentsCountry,
            department: state.filters.respondentsDepartment
        }
    );


    const empty =
        document.getElementById("respondents-empty");

    if (empty) {
        empty.hidden = data.length > 0;
    }


    if (!data.length) {
        clearChart("respondents-region-chart");
        clearChart("respondents-department-chart");
        clearChart("respondents-trend-chart");
        return;
    }


    /*
     * Total
     */

    const totalRespondents = sumBy(
        data,
        "respondent_count"
    );


    setText(
        "respondents-total",
        formatNumber(totalRespondents)
    );


    /*
     * Região
     */

    const regionGroups = groupBy(
        data,
        item => item.region || "Não informado"
    );


    const regionTotals = [...regionGroups.entries()]
        .map(([region, items]) => ({
            region,
            total: sumBy(items, "respondent_count")
        }))
        .sort((a, b) => b.total - a.total);


    setText(
        "respondents-top-region",
        regionTotals[0]?.region || "—"
    );


    setText(
        "respondents-top-region-description",
        regionTotals[0]
            ? `${ formatNumber(regionTotals[0].total) } respondentes`
            : "Aguardando dados"
    );


    /*
     * Departamento
     */

    const departmentGroups = groupBy(
        data,
        item => item.department || "Não informado"
    );


    const departmentTotals = [...departmentGroups.entries()]
        .map(([department, items]) => ({
            department,
            total: sumBy(items, "respondent_count")
        }))
        .sort((a, b) => b.total - a.total);


    setText(
        "respondents-top-department",
        departmentTotals[0]?.department || "—"
    );


    setText(
        "respondents-top-department-description",
        departmentTotals[0]
            ? `${ formatNumber(departmentTotals[0].total) } respondentes`
            : "Aguardando dados"
    );


    /*
     * Região
     */

    renderChart(
        "respondents-region-chart",
        {
            type: "bar",

            data: {
                labels: regionTotals.map(
                    item => item.region
                ),

                datasets: [{
                    label: "Respondentes",

                    data: regionTotals.map(
                        item => item.total
                    ),

                    backgroundColor: "#526581",

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: baseHorizontalBarOptions()
        }
    );


    /*
     * Departamento
     */

    renderChart(
        "respondents-department-chart",
        {
            type: "bar",

            data: {
                labels: departmentTotals.map(
                    item => item.department
                ),

                datasets: [{
                    label: "Respondentes",

                    data: departmentTotals.map(
                        item => item.total
                    ),

                    backgroundColor: "#779477",

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: baseHorizontalBarOptions()
        }
    );


    /*
     * Evolução
     */

    const periods = sortPeriods(
        uniqueSorted(
            data.map(item => item.period)
        )
    );


    const periodTotals = periods.map(period => {

        const items = data.filter(
            item => item.period === period
        );

        /*
         * O respondent_count já representa a quantidade
         * agregada de respondentes naquele agrupamento.
         */
        return sumBy(items, "respondent_count");
    });


    renderChart(
        "respondents-trend-chart",
        {
            type: "line",

            data: {
                labels: periods,

                datasets: [{
                    label: "Respondentes",

                    data: periodTotals,

                    borderColor: "#779477",
                    backgroundColor: "rgba(119, 148, 119, 0.08)",

                    fill: true,
                    tension: 0.35,

                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },

            options: baseLineOptions()
        }
    );
}


/* =========================================================
   03 — SCORE DISTRIBUTION
========================================================= */

function populateDistributionFilters() {

    const data = state.data.scoreDistribution;

    populateSelect(
        "distribution-period-filter",
        data.map(item => item.period),
        state.filters.distributionPeriod,
        "Todos os períodos"
    );

    populateSelect(
        "distribution-region-filter",
        data.map(item => item.region),
        state.filters.distributionRegion,
        "Todas as regiões"
    );

    populateSelect(
        "distribution-category-filter",
        data.map(item => item.category),
        state.filters.distributionCategory,
        "Todas as categorias"
    );

    populateSelect(
        "distribution-subcategory-filter",
        data.map(item => item.subcategory),
        state.filters.distributionSubcategory,
        "Todas as subcategorias"
    );
}


function renderScoreDistribution() {

    const data = getFilteredData(
        state.data.scoreDistribution,
        {
            period: state.filters.distributionPeriod,
            region: state.filters.distributionRegion,
            category: state.filters.distributionCategory,
            subcategory: state.filters.distributionSubcategory
        }
    );


    const empty =
        document.getElementById("score-distribution-empty");

    if (empty) {
        empty.hidden = data.length > 0;
    }


    if (!data.length) {
        clearChart("score-distribution-chart");
        clearChart("distribution-category-chart");
        renderRanking("distribution-ranking", []);
        return;
    }


    /*
     * Total
     */

    const total = sumBy(data, "count");

    setText(
        "distribution-total",
        formatNumber(total)
    );


    /*
     * Faixa predominante
     */

    const bucketGroups = groupBy(
        data,
        item => item.score_range_bucket
    );


    const bucketTotals = [...bucketGroups.entries()]
        .map(([bucket, items]) => ({
            bucket,
            total: sumBy(items, "count")
        }))
        .sort((a, b) => b.total - a.total);


    setText(
        "distribution-main-range",
        bucketTotals[0]?.bucket || "—"
    );


    setText(
        "distribution-main-range-description",
        bucketTotals[0]
            ? `${ formatNumber(bucketTotals[0].total) } ocorrências`
            : "Aguardando dados"
    );


    /*
     * Categoria predominante
     */

    const categoryGroups = groupBy(
        data,
        item => item.category
    );


    const categoryTotals = [...categoryGroups.entries()]
        .map(([category, items]) => ({
            category,
            total: sumBy(items, "count")
        }))
        .sort((a, b) => b.total - a.total);


    setText(
        "distribution-main-category",
        categoryTotals[0]?.category || "—"
    );


    setText(
        "distribution-main-category-description",
        categoryTotals[0]
            ? `${ formatNumber(categoryTotals[0].total) } ocorrências`
            : "Aguardando dados"
    );


    /*
     * Distribuição por faixa
     */

    const availableBuckets = uniqueSorted(
        data.map(item => item.score_range_bucket)
    );


    const orderedBuckets = [
        ...SCORE_BUCKET_ORDER.filter(
            bucket => availableBuckets.includes(bucket)
        ),
        ...availableBuckets.filter(
            bucket => !SCORE_BUCKET_ORDER.includes(bucket)
        )
    ];


    const categories = uniqueSorted(
        data.map(item => item.category)
    );


    const distributionDatasets = categories.map(
        (category, index) => {

            const categoryData = data.filter(
                item => item.category === category
            );

            const colorPalette = [
                "#526581",
                "#779477",
                "#a38b68",
                "#8b7d9d",
                "#71828b",
                "#9b7067"
            ];

            return {
                label: category,

                data: orderedBuckets.map(bucket => {

                    const items = categoryData.filter(
                        item =>
                            item.score_range_bucket === bucket
                    );

                    return sumBy(items, "count");
                }),

                backgroundColor:
                    colorPalette[index % colorPalette.length],

                borderRadius: 4,

                borderSkipped: false
            };
        }
    );


    renderChart(
        "score-distribution-chart",
        {
            type: "bar",

            data: {
                labels: orderedBuckets,

                datasets: distributionDatasets
            },

            options: {
                ...baseBarOptions(),

                scales: {
                    x: {
                        stacked: true,

                        grid: {
                            display: false
                        }
                    },

                    y: {
                        stacked: true,

                        beginAtZero: true,

                        grid: {
                            color: "#edf0f2"
                        },

                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        }
    );


    /*
     * Categoria
     */

    renderChart(
        "distribution-category-chart",
        {
            type: "bar",

            data: {
                labels: categoryTotals.map(
                    item => item.category
                ),

                datasets: [{
                    label: "Ocorrências",

                    data: categoryTotals.map(
                        item => item.total
                    ),

                    backgroundColor: "#526581",

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: baseHorizontalBarOptions()
        }
    );


    /*
     * Ranking de subcategorias
     *
     * Atenção:
     * Consideramos como faixas inferiores aquelas que começam
     * abaixo de 3.5, sem assumir que exista necessariamente
     * apenas um bucket específico.
     */

    const lowBucketData = data.filter(item => {

        const bucket = normalizeText(
            item.score_range_bucket
        ).toLowerCase();

        return (
            bucket.startsWith("1") ||
            bucket.startsWith("2")
        );
    });


    const subcategoryGroups = groupBy(
        lowBucketData,
        item => item.subcategory
    );


    const ranking = [...subcategoryGroups.entries()]
        .map(([subcategory, items]) => ({
            title: subcategory,
            value: sumBy(items, "count"),
            description: "Ocorrências em faixas inferiores"
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);


    renderRanking(
        "distribution-ranking",
        ranking
    );
}


/* =========================================================
   04 — SCORE AVERAGE
========================================================= */

function populateScoreFilters() {

    const data = state.data.scoreAverage;

    populateSelect(
        "score-region-filter",
        data.map(item => item.region),
        state.filters.scoreRegion,
        "Todas as regiões"
    );

    populateSelect(
        "score-country-filter",
        data.map(item => item.country),
        state.filters.scoreCountry,
        "Todos os países"
    );

    populateSelect(
        "score-category-filter",
        data.map(item => item.category),
        state.filters.scoreCategory,
        "Todas as categorias"
    );

    populateSelect(
        "score-subcategory-filter",
        data.map(item => item.subcategory),
        state.filters.scoreSubcategory,
        "Todas as subcategorias"
    );
}


function renderScoreAverage() {

    const data = getFilteredData(
        state.data.scoreAverage,
        {
            region: state.filters.scoreRegion,
            country: state.filters.scoreCountry,
            category: state.filters.scoreCategory,
            subcategory: state.filters.scoreSubcategory
        }
    );


    const empty =
        document.getElementById("score-average-empty");

    if (empty) {
        empty.hidden = data.length > 0;
    }


    if (!data.length) {
        clearChart("score-average-chart");
        clearChart("score-country-chart");
        renderRanking("score-ranking", []);
        return;
    }


    const periods = sortPeriods(
        uniqueSorted(
            data.map(item => item.period)
        )
    );


    const currentPeriod = periods.at(-1);
    const previous = periods.at(-2);


    /*
     * Score médio atual
     */

    const currentItems = data.filter(
        item => item.period === currentPeriod
    );


    const currentScore = average(
        currentItems.map(
            item => item.avg_score
        )
    );


    setText(
        "score-current",
        currentScore !== null
            ? formatDecimal(currentScore)
            : "—"
    );


    setText(
        "score-current-period",
        currentPeriod
            ? `Período ${ currentPeriod } `
            : "Aguardando dados"
    );


    /*
     * Score anterior
     */

    const previousItems = data.filter(
        item => item.period === previous
    );


    const previousScore = average(
        previousItems.map(
            item => item.avg_score
        )
    );


    const change =
        currentScore !== null &&
        previousScore !== null
            ? currentScore - previousScore
            : null;


    setText(
        "score-change",
        change !== null
            ? formatSigned(change)
            : "—"
    );


    setText(
        "score-change-description",
        previous
            ? `Comparação com ${ previous } `
            : "Sem período anterior"
    );


    /*
     * Evolução por subcategoria
     */

    const subcategoryGroups = groupBy(
        data,
        item => item.subcategory
    );


    const evolution = [];


    subcategoryGroups.forEach(
        (items, subcategory) => {

            const currentItem = items.filter(
                item => item.period === currentPeriod
            );

            const previousItem = items.filter(
                item => item.period === previous
            );


            const currentValue = average(
                currentItem.map(
                    item => item.avg_score
                )
            );

            const previousValue = average(
                previousItem.map(
                    item => item.avg_score
                )
            );


            if (
                currentValue === null ||
                previousValue === null
            ) {
                return;
            }


            evolution.push({
                subcategory,
                current: currentValue,
                previous: previousValue,
                change: currentValue - previousValue
            });
        }
    );


    const bestEvolution = [...evolution]
        .sort((a, b) => b.change - a.change)[0];


    const worstEvolution = [...evolution]
        .sort((a, b) => a.change - b.change)[0];


    setText(
        "score-best-subcategory",
        bestEvolution?.subcategory || "—"
    );


    setText(
        "score-best-subcategory-change",
        bestEvolution
            ? formatSigned(bestEvolution.change)
            : "Sem comparação disponível"
    );


    setText(
        "score-worst-subcategory",
        worstEvolution?.subcategory || "—"
    );


    setText(
        "score-worst-subcategory-change",
        worstEvolution
            ? formatSigned(worstEvolution.change)
            : "Sem comparação disponível"
    );


    /*
     * Gráfico de evolução
     */

    const subcategories = uniqueSorted(
        data.map(item => item.subcategory)
    );


    const palette = [
        "#526581",
        "#779477",
        "#a38b68",
        "#8b7d9d",
        "#71828b",
        "#9b7067",
        "#647d8a",
        "#8a8762"
    ];


    const datasets = subcategories.map(
        (subcategory, index) => {

            const items = data.filter(
                item =>
                    item.subcategory === subcategory
            );


            const values = periods.map(period => {

                const periodItems = items.filter(
                    item => item.period === period
                );

                return average(
                    periodItems.map(
                        item => item.avg_score
                    )
                );
            });


            return {
                label: subcategory,

                data: values,

                borderColor:
                    palette[index % palette.length],

                backgroundColor: "transparent",

                tension: 0.3,

                spanGaps: true,

                pointRadius: 2.5,

                pointHoverRadius: 5
            };
        }
    );


    renderChart(
        "score-average-chart",
        {
            type: "line",

            data: {
                labels: periods,
                datasets
            },

            options: baseLineOptions()
        }
    );


    /*
     * Ranking atual
     */

    const ranking = currentItems
        .reduce((accumulator, item) => {

            const existing =
                accumulator.find(
                    entry =>
                        entry.title === item.subcategory
                );

            if (!existing) {

                accumulator.push({
                    title: item.subcategory,
                    value: toNumber(item.avg_score),
                    description:
                        item.category || ""
                });

                return accumulator;
            }


            existing.value = average([
                existing.value,
                toNumber(item.avg_score)
            ]);

            return accumulator;

        }, [])
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);


    renderRanking(
        "score-ranking",
        ranking
    );


    /*
     * Comparação entre países
     */

    const countryGroups = groupBy(
        currentItems,
        item => item.country || "Não informado"
    );


    const countryScores = [...countryGroups.entries()]
        .map(([country, items]) => ({
            country,
            score: average(
                items.map(
                    item => item.avg_score
                )
            )
        }))
        .filter(item => item.score !== null)
        .sort((a, b) => b.score - a.score);


    renderChart(
        "score-country-chart",
        {
            type: "bar",

            data: {
                labels: countryScores.map(
                    item => item.country
                ),

                datasets: [{
                    label: "Score médio",

                    data: countryScores.map(
                        item => item.score
                    ),

                    backgroundColor: "#526581",

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: {
                ...baseHorizontalBarOptions(),

                scales: {
                    x: {
                        min: 1,
                        max: 5,

                        grid: {
                            color: "#edf0f2"
                        }
                    }
                }
            }
        }
    );
}


/* =========================================================
   05 — AGGREGATE OVERALL
========================================================= */

function renderAggregateOverall() {

    const data = state.data.aggregateOverall;

    const empty =
        document.getElementById("aggregate-empty");

    if (empty) {
        empty.hidden = data.length > 0;
    }


    if (!data.length) {
        clearChart("overall-trend-chart");
        clearChart("region-score-chart");
        clearInsights();
        return;
    }


    const periods = sortPeriods(
        uniqueSorted(
            data.map(item => item.period)
        )
    );


    const currentPeriod = periods.at(-1);


    const currentItems = data.filter(
        item => item.period === currentPeriod
    );


    /*
     * Score geral
     */

    const overallScore = average(
        currentItems.map(
            item => item.avg_score
        )
    );


    setText(
        "overall-score",
        overallScore !== null
            ? formatDecimal(overallScore)
            : "—"
    );


    setText(
        "overall-score-description",
        currentPeriod
            ? `Período ${ currentPeriod } `
            : "Aguardando dados"
    );


    /*
     * Respondentes
     */

    const totalRespondents = sumBy(
        currentItems,
        "respondent_count"
    );


    setText(
        "overall-respondents",
        formatNumber(totalRespondents)
    );


    setText(
        "overall-respondents-description",
        currentPeriod
            ? `Participantes em ${ currentPeriod } `
            : "Aguardando dados"
    );


    /*
     * Regiões
     */

    const regionGroups = groupBy(
        currentItems,
        item => item.region || "Não informado"
    );


    const regionScores = [...regionGroups.entries()]
        .map(([region, items]) => ({
            region,

            score: average(
                items.map(
                    item => item.avg_score
                )
            )
        }))
        .filter(item => item.score !== null)
        .sort((a, b) => b.score - a.score);


    const bestRegion = regionScores[0];
    const worstRegion =
        regionScores[regionScores.length - 1];


    setText(
        "overall-best-region",
        bestRegion?.region || "—"
    );


    setText(
        "overall-best-region-score",
        bestRegion
            ? `Score ${ formatDecimal(bestRegion.score) } `
            : "Aguardando dados"
    );


    setText(
        "overall-worst-region",
        worstRegion?.region || "—"
    );


    setText(
        "overall-worst-region-score",
        worstRegion
            ? `Score ${ formatDecimal(worstRegion.score) } `
            : "Aguardando dados"
    );


    /*
     * Evolução geral
     *
     * Como aggregate-overall pode conter mais de uma categoria
     * por período, calculamos a média dos registros daquele período.
     */

    const periodScores = periods.map(period => {

        const items = data.filter(
            item => item.period === period
        );

        return average(
            items.map(
                item => item.avg_score
            )
        );
    });


    renderChart(
        "overall-trend-chart",
        {
            type: "line",

            data: {
                labels: periods,

                datasets: [{
                    label: "Score médio geral",

                    data: periodScores,

                    borderColor: "#526581",
                    backgroundColor: "rgba(82, 101, 129, 0.08)",

                    fill: true,

                    tension: 0.35,

                    spanGaps: true,

                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },

            options: {
                ...baseLineOptions(),

                scales: {
                    y: {
                        min: 1,
                        max: 5,

                        grid: {
                            color: "#edf0f2"
                        }
                    }
                }
            }
        }
    );


    /*
     * Score por região
     */

    renderChart(
        "region-score-chart",
        {
            type: "bar",

            data: {
                labels: regionScores.map(
                    item => item.region
                ),

                datasets: [{
                    label: "Score médio",

                    data: regionScores.map(
                        item => item.score
                    ),

                    backgroundColor: "#526581",

                    borderRadius: 5,

                    borderSkipped: false
                }]
            },

            options: {
                ...baseHorizontalBarOptions(),

                scales: {
                    x: {
                        min: 1,
                        max: 5,

                        grid: {
                            color: "#edf0f2"
                        }
                    }
                }
            }
        }
    );


    renderInsights(
        data,
        regionScores
    );
}


/* =========================================================
   INSIGHTS
========================================================= */

function renderInsights(
    aggregateData,
    regionScores
) {

    const scoreData = state.data.scoreAverage;


    /*
     * Melhor / pior subcategoria
     */

    const periods = sortPeriods(
        uniqueSorted(
            scoreData.map(item => item.period)
        )
    );


    const currentPeriod = periods.at(-1);
    const previous = periods.at(-2);


    let evolution = [];


    if (currentPeriod && previous) {

        const groups = groupBy(
            scoreData,
            item => item.subcategory
        );


        groups.forEach(
            (items, subcategory) => {

                const current = average(
                    items
                        .filter(
                            item =>
                                item.period === currentPeriod
                        )
                        .map(
                            item => item.avg_score
                        )
                );


                const old = average(
                    items
                        .filter(
                            item =>
                                item.period === previous
                        )
                        .map(
                            item => item.avg_score
                        )
                );


                if (
                    current === null ||
                    old === null
                ) {
                    return;
                }


                evolution.push({
                    subcategory,
                    change: current - old,
                    current
                });
            }
        );
    }


    const best = [...evolution]
        .sort((a, b) => b.change - a.change)[0];


    const worst = [...evolution]
        .sort((a, b) => a.change - b.change)[0];


    /*
     * Ponto de atenção:
     * menor score atual.
     */

    const currentScoreItems =
        scoreData.filter(
            item =>
                item.period === currentPeriod
        );


    const subcategoryScores = [...groupBy(
        currentScoreItems,
        item => item.subcategory
    ).entries()]
        .map(([subcategory, items]) => ({
            subcategory,

            score: average(
                items.map(
                    item => item.avg_score
                )
            )
        }))
        .filter(item => item.score !== null)
        .sort((a, b) => a.score - b.score);


    const attention =
        subcategoryScores[0];


    /*
     * Atenção regional:
     * menor score regional.
     */

    const regionAttention =
        regionScores.at(-1);


    /*
     * Card 1
     */

    if (attention) {

        setText(
            "insight-attention-title",
            attention.subcategory
        );

        setText(
            "insight-attention-metric",
            formatDecimal(attention.score)
        );

        setText(
            "insight-attention-description",
            `Menor score médio registrado no período ${ currentPeriod }.`
        );
    }

    else {

        setText(
            "insight-attention-title",
            "Sem dados suficientes"
        );

        setText(
            "insight-attention-metric",
            "—"
        );
    }


    /*
     * Card 2
     */

    if (best) {

        setText(
            "insight-positive-title",
            best.subcategory
        );

        setText(
            "insight-positive-metric",
            formatSigned(best.change)
        );

        setText(
            "insight-positive-description",
            `Variação entre ${ previous } e ${ currentPeriod }.`
        );
    }

    else {

        setText(
            "insight-positive-title",
            "Sem comparação"
        );

        setText(
            "insight-positive-metric",
            "—"
        );

        setText(
            "insight-positive-description",
            "É necessário mais de um período para avaliar evolução."
        );
    }


    /*
     * Card 3
     */

    if (regionAttention) {

        setText(
            "insight-region-title",
            regionAttention.region
        );

        setText(
            "insight-region-metric",
            formatDecimal(regionAttention.score)
        );

        setText(
            "insight-region-description",
            "Região com menor score médio no período mais recente."
        );
    }

    else {

        setText(
            "insight-region-title",
            "Sem dados suficientes"
        );

        setText(
            "insight-region-metric",
            "—"
        );

        setText(
            "insight-region-description",
            "Não foi possível comparar as regiões."
        );
    }
}


function clearInsights() {

    setText(
        "insight-attention-title",
        "—"
    );

    setText(
        "insight-attention-metric",
        "—"
    );

    setText(
        "insight-attention-description",
        "Aguardando dados."
    );


    setText(
        "insight-positive-title",
        "—"
    );

    setText(
        "insight-positive-metric",
        "—"
    );

    setText(
        "insight-positive-description",
        "Aguardando dados."
    );


    setText(
        "insight-region-title",
        "—"
    );

    setText(
        "insight-region-metric",
        "—"
    );

    setText(
        "insight-region-description",
        "Aguardando dados."
    );
}


/* =========================================================
   RANKING
========================================================= */

function renderRanking(elementId, items) {

    const container =
        document.getElementById(elementId);

    if (!container) {
        return;
    }


    if (!items.length) {

        container.innerHTML = `
    < div class="ranking-empty" >
        Nenhum dado disponível.
            </ >
    `;

        return;
    }


    container.innerHTML = items
        .map((item, index) => {

            return `
    <div class="ranking-item" >

                    <span class="ranking-position">
                        ${index + 1}
                    </span>

                    <div class="ranking-content">

                        <span class="ranking-title">
                            ${escapeHtml(item.title)}
                        </span>

                        <span class="ranking-description">
                            ${escapeHtml(item.description || "")}
                        </span>

                    </div>

                    <span class="ranking-value">
                        ${
                            typeof item.value === "number"
                                ? formatDecimal(item.value)
                                : escapeHtml(item.value)
                        }
                    </span>

                </div>
    `;
        })
        .join("");
}


/* =========================================================
   CHARTS
========================================================= */

function renderChart(canvasId, config) {

    const canvas =
        document.getElementById(canvasId);

    if (!canvas) {
        return;
    }


    if (state.charts[canvasId]) {

        state.charts[canvasId].data =
            config.data;

        state.charts[canvasId].options =
            config.options;

        state.charts[canvasId].update();

        return;
    }


    state.charts[canvasId] =
        new Chart(canvas, config);
}


function clearChart(canvasId) {

    if (!state.charts[canvasId]) {
        return;
    }

    state.charts[canvasId].data.labels = [];

    state.charts[canvasId].data.datasets = [];

    state.charts[canvasId].update();
}


/* =========================================================
   CHART OPTIONS
========================================================= */

function baseChartOptions() {

    return {
        responsive: true,

        maintainAspectRatio: false,

        animation: {
            duration: 350
        },

        plugins: {

            legend: {
                position: "bottom",

                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",

                    padding: 18,

                    color: "#626b75",

                    font: {
                        size: 10
                    }
                }
            },

            tooltip: {
                backgroundColor: "#20252b",

                titleColor: "#ffffff",
                bodyColor: "#ffffff",

                padding: 10,

                cornerRadius: 7
            }
        }
    };
}


function baseLineOptions() {

    return {
        ...baseChartOptions(),

        scales: {

            x: {
                grid: {
                    display: false
                },

                ticks: {
                    color: "#8b949e",

                    font: {
                        size: 10
                    }
                }
            },

            y: {
                beginAtZero: false,

                grid: {
                    color: "#edf0f2"
                },

                ticks: {
                    color: "#8b949e",

                    font: {
                        size: 10
                    }
                }
            }
        }
    };
}


function baseBarOptions() {

    return {
        ...baseChartOptions(),

        plugins: {
            ...baseChartOptions().plugins,

            legend: {
                ...baseChartOptions().plugins.legend
            }
        },

        scales: {

            x: {
                grid: {
                    display: false
                },

                ticks: {
                    color: "#8b949e",

                    font: {
                        size: 10
                    }
                }
            },

            y: {
                beginAtZero: true,

                grid: {
                    color: "#edf0f2"
                },

                ticks: {
                    color: "#8b949e",

                    precision: 0,

                    font: {
                        size: 10
                    }
                }
            }
        }
    };
}


function baseHorizontalBarOptions() {

    return {
        ...baseChartOptions(),

        indexAxis: "y",

        scales: {

            x: {
                beginAtZero: true,

                grid: {
                    color: "#edf0f2"
                },

                ticks: {
                    color: "#8b949e",

                    precision: 0,

                    font: {
                        size: 10
                    }
                }
            },

            y: {
                grid: {
                    display: false
                },

                ticks: {
                    color: "#626b75",

                    font: {
                        size: 10
                    }
                }
            }
        }
    };
}


/* =========================================================
   DOM
========================================================= */

function setText(elementId, value) {

    const element =
        document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "—"
            : value;
}


/* =========================================================
   FILTROS — EVENTOS
========================================================= */

function setupFilters() {

    /*
     * Response counts
     */

    bindFilter(
        "response-period-filter",
        "responsePeriod",
        renderResponseCounts
    );

    bindFilter(
        "response-region-filter",
        "responseRegion",
        renderResponseCounts
    );

    bindFilter(
        "response-country-filter",
        "responseCountry",
        renderResponseCounts
    );

    bindFilter(
        "response-category-filter",
        "responseCategory",
        renderResponseCounts
    );


    /*
     * Respondents
     */

    bindFilter(
        "respondents-period-filter",
        "respondentsPeriod",
        renderRespondents
    );

    bindFilter(
        "respondents-region-filter",
        "respondentsRegion",
        renderRespondents
    );

    bindFilter(
        "respondents-country-filter",
        "respondentsCountry",
        renderRespondents
    );

    bindFilter(
        "respondents-department-filter",
        "respondentsDepartment",
        renderRespondents
    );


    /*
     * Distribution
     */

    bindFilter(
        "distribution-period-filter",
        "distributionPeriod",
        renderScoreDistribution
    );

    bindFilter(
        "distribution-region-filter",
        "distributionRegion",
        renderScoreDistribution
    );

    bindFilter(
        "distribution-category-filter",
        "distributionCategory",
        renderScoreDistribution
    );

    bindFilter(
        "distribution-subcategory-filter",
        "distributionSubcategory",
        renderScoreDistribution
    );


    /*
     * Score average
     */

    bindFilter(
        "score-region-filter",
        "scoreRegion",
        renderScoreAverage
    );

    bindFilter(
        "score-country-filter",
        "scoreCountry",
        renderScoreAverage
    );

    bindFilter(
        "score-category-filter",
        "scoreCategory",
        renderScoreAverage
    );

    bindFilter(
        "score-subcategory-filter",
        "scoreSubcategory",
        renderScoreAverage
    );
}


function bindFilter(
    elementId,
    stateKey,
    callback
) {

    const element =
        document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.addEventListener(
        "change",
        event => {

            state.filters[stateKey] =
                event.target.value;

            callback();
        }
    );
}


/* =========================================================
   ATUALIZAÇÃO DO FOOTER
========================================================= */

function updateLastUpdate() {

    const element =
        document.getElementById("last-update");

    if (!element) {
        return;
    }


    if (!state.lastUpdatedAt) {

        element.textContent =
            "Última atualização: —";

        return;
    }


    const date =
        new Date(state.lastUpdatedAt);


    if (Number.isNaN(date.getTime())) {

        element.textContent =
            `Última atualização: ${ state.lastUpdatedAt } `;

        return;
    }


    element.textContent =
        `Última atualização: ${
    date.toLocaleString(
        "pt-BR",
        {
            dateStyle: "short",
            timeStyle: "medium"
        }
    )
} `;
}


/* =========================================================
   RENDER PRINCIPAL
========================================================= */

function renderDashboard() {

    /*
     * 01
     */
    populateResponseFilters();
    renderResponseCounts();


    /*
     * 02
     */
    populateRespondentFilters();
    renderRespondents();


    /*
     * 03
     */
    populateDistributionFilters();
    renderScoreDistribution();


    /*
     * 04
     */
    populateScoreFilters();
    renderScoreAverage();


    /*
     * 05
     */
    renderAggregateOverall();


    /*
     * Status
     */
    updateAllStatuses();

    updateLastUpdate();
}


/* =========================================================
   POLLING
========================================================= */

async function refreshDashboard() {

    try {

        const payload =
            await fetchDashboardData();


        processApiResponse(payload);


        renderDashboard();


        state.isFirstLoad = false;

    }

    catch (error) {

        console.error(
            "Erro ao atualizar dashboard:",
            error
        );


        /*
         * Não apagamos dados antigos.
         * Apenas marcamos os serviços como indisponíveis
         * caso não exista informação válida no momento.
         */

        Object.keys(state.status).forEach(key => {

            if (!state.lastValidData[key]) {
                state.status[key] = "unavailable";
            }
            else {
                state.status[key] = "error";
            }
        });


        updateAllStatuses();


        if (state.isFirstLoad) {
            renderDashboard();
        }
    }
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupFilters();
        setupChat();          
        setupChatToggle();
        refreshDashboard();

        setInterval(
            refreshDashboard,
            POLLING_INTERVAL
        );
    }
);


const CHAT_API_URL = "/api/chat";

const chatState = {
    isSending: false
};


function appendChatMessage(role, text) {

    const container = document.getElementById("chat-messages");

    if (!container) {
        return;
    }

    const messageEl = document.createElement("div");

    messageEl.classList.add(
        "chat-message",
        role === "user" ? "chat-message-user" : "chat-message-assistant"
    );

    messageEl.textContent = text;

    container.appendChild(messageEl);

    container.scrollTop = container.scrollHeight;
}


function appendChatStatus(text) {

    const container = document.getElementById("chat-messages");

    if (!container) {
        return null;
    }

    const statusEl = document.createElement("div");

    statusEl.classList.add("chat-message", "chat-message-status");
    statusEl.textContent = text;

    container.appendChild(statusEl);
    container.scrollTop = container.scrollHeight;

    return statusEl;
}


async function sendChatMessage(message) {

    const response = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.reply || payload.error || "Erro ao consultar o chat.");
    }

    return payload.reply;
}


function setChatFormDisabled(disabled) {

    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-form");

    if (input) {
        input.disabled = disabled;
    }

    if (form) {
        const button = form.querySelector("button");

        if (button) {
            button.disabled = disabled;
        }
    }
}


function setupChat() {

    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");

    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        if (chatState.isSending) {
            return;
        }

        const message = input.value.trim();

        if (!message) {
            return;
        }

        appendChatMessage("user", message);
        input.value = "";

        chatState.isSending = true;
        setChatFormDisabled(true);

        const statusEl = appendChatStatus("Consultando indicadores...");

        try {
            const reply = await sendChatMessage(message);

            if (statusEl) {
                statusEl.remove();
            }

            appendChatMessage("assistant", reply);
        }
        catch (error) {

            if (statusEl) {
                statusEl.remove();
            }

            appendChatMessage(
                "assistant",
                "Não foi possível obter uma resposta agora. Tente novamente em instantes."
            );

            console.error("Erro no chat:", error);
        }
        finally {
            chatState.isSending = false;
            setChatFormDisabled(false);
            input.focus();
        }
    });
}

function setupChatToggle() {

    const toggleButton = document.getElementById("chat-toggle");
    const closeButton = document.getElementById("chat-close");
    const panel = document.getElementById("chat-panel");

    if (!toggleButton || !panel) {
        return;
    }

    toggleButton.addEventListener("click", () => {
        panel.hidden = !panel.hidden;

        if (!panel.hidden) {
            document.getElementById("chat-input")?.focus();
        }
    });

    closeButton?.addEventListener("click", () => {
        panel.hidden = true;
    });
}