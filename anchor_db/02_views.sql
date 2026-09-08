-- Serviço 1: contagens brutas anônimas
CREATE VIEW vw_response_counts AS
SELECT
    qn.period,
    r.region,
    r.country,
    q.category,
    q.subcategory,
    ro.label AS option_label,
    COUNT(*) AS response_count
FROM responses resp
JOIN respondents r ON r.id = resp.respondent_id
JOIN questions q ON q.id = resp.question_id
JOIN response_options ro ON ro.id = resp.option_id
JOIN questionnaires qn ON qn.id = resp.questionnaire_id
GROUP BY qn.period, r.region, r.country, q.category, q.subcategory, ro.label;

CREATE VIEW vw_respondent_counts AS
SELECT
    qn.period,
    r.region,
    r.country,
    r.department,
    COUNT(DISTINCT r.id) AS respondent_count
FROM responses resp
JOIN respondents r ON r.id = resp.respondent_id
JOIN questionnaires qn ON qn.id = resp.questionnaire_id
GROUP BY qn.period, r.region, r.country, r.department
HAVING COUNT(DISTINCT r.id) >= 5;

CREATE VIEW vw_score_distribution AS
WITH scores_raw AS (
    SELECT
        resp.respondent_id,
        qn.period,
        q.category,
        q.subcategory,
        ROUND(AVG(
            CASE
                WHEN q.polarity = 'negative' THEN 6 - ro.scale_value
                ELSE ro.scale_value
            END
        ), 2) AS score_value
    FROM responses resp
    JOIN questions q ON q.id = resp.question_id
    JOIN response_options ro ON ro.id = resp.option_id
    JOIN questionnaires qn ON qn.id = resp.questionnaire_id
    GROUP BY resp.respondent_id, qn.period, q.category, q.subcategory
)
SELECT
    sr.period,
    r.region,
    sr.category,
    sr.subcategory,
    CASE
        WHEN sr.score_value < 2 THEN '0-2'
        WHEN sr.score_value < 3.5 THEN '2-3.5'
        ELSE '3.5-5'
    END AS score_range_bucket,
    COUNT(*) AS count
FROM scores_raw sr
JOIN respondents r ON r.id = sr.respondent_id
GROUP BY sr.period, r.region, sr.category, sr.subcategory, score_range_bucket;

CREATE VIEW vw_score_average AS
WITH scores_raw AS (
    SELECT
        resp.respondent_id,
        qn.period,
        q.category,
        q.subcategory,
        ROUND(AVG(
            CASE
                WHEN q.polarity = 'negative' THEN 6 - ro.scale_value
                ELSE ro.scale_value
            END
        ), 2) AS score_value
    FROM responses resp
    JOIN questions q ON q.id = resp.question_id
    JOIN response_options ro ON ro.id = resp.option_id
    JOIN questionnaires qn ON qn.id = resp.questionnaire_id
    GROUP BY resp.respondent_id, qn.period, q.category, q.subcategory
)
SELECT
    sr.period,
    r.region,
    r.country,
    sr.category,
    sr.subcategory,
    ROUND(AVG(sr.score_value), 2) AS avg_score,
    COUNT(DISTINCT sr.respondent_id) AS respondent_count
FROM scores_raw sr
JOIN respondents r ON r.id = sr.respondent_id
GROUP BY sr.period, r.region, r.country, sr.category, sr.subcategory
HAVING COUNT(DISTINCT sr.respondent_id) >= 5;

-- Serviço 3: agregação geral
CREATE VIEW vw_aggregate_overall AS
SELECT
    period,
    region,
    category,
    ROUND(AVG(avg_score), 2) AS avg_score,
    SUM(respondent_count) AS respondent_count
FROM vw_score_average
GROUP BY period, region, category;