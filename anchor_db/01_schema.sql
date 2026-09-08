CREATE TABLE respondents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    country VARCHAR(50) NOT NULL,
    region VARCHAR(20) NOT NULL,
    department VARCHAR(50) NOT NULL,
    team VARCHAR(50) NOT NULL,
    hire_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE questionnaires (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    period VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    text VARCHAR(300) NOT NULL,
    category VARCHAR(80) NOT NULL,
    subcategory VARCHAR(80) NOT NULL,
    polarity VARCHAR(8) NOT NULL CHECK (polarity IN ('positive', 'negative'))
);

CREATE TABLE response_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    label VARCHAR(80) NOT NULL,
    scale_value INTEGER NOT NULL
);

CREATE TABLE responses (
    id SERIAL PRIMARY KEY,
    respondent_id INTEGER NOT NULL REFERENCES respondents(id),
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    option_id INTEGER NOT NULL REFERENCES response_options(id),
    submitted_at TIMESTAMP DEFAULT now()
);