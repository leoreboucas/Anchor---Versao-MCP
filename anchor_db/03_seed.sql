BEGIN;

-- ============================================================
-- LIMPEZA
-- ============================================================

TRUNCATE TABLE
    responses,
    response_options,
    questions,
    questionnaires,
    respondents
RESTART IDENTITY CASCADE;


-- ============================================================
-- 1. RESPONDENTES
-- ============================================================

DO $$
DECLARE
    i INTEGER;

    first_names TEXT[] := ARRAY[
        'Lucas', 'Gabriel', 'Rafael', 'Matheus', 'Felipe',
        'Leonardo', 'Bruno', 'Gustavo', 'Thiago', 'André',
        'Carlos', 'Daniel', 'Eduardo', 'Marcelo', 'Rodrigo',
        'João', 'Pedro', 'Henrique', 'Victor', 'Caio',
        'Arthur', 'Miguel', 'Davi', 'Samuel', 'Enzo',
        'Ana', 'Mariana', 'Beatriz', 'Camila', 'Juliana',
        'Larissa', 'Fernanda', 'Amanda', 'Isabela', 'Gabriela',
        'Letícia', 'Carolina', 'Laura', 'Manuela', 'Sofia'
    ];

    last_names TEXT[] := ARRAY[
        'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira',
        'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima',
        'Araujo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins',
        'Ribeiro', 'Barbosa', 'Moura', 'Dias', 'Teixeira',
        'Moreira', 'Correia', 'Mendes', 'Cardoso', 'Pinto'
    ];

    departments TEXT[] := ARRAY[
        'Engenharia',
        'Vendas',
        'Marketing',
        'RH',
        'Financeiro',
        'Suporte/CS',
        'Jurídico',
        'Operações'
    ];

    department_for_employee TEXT;
    country_for_employee TEXT;
    region_for_employee TEXT;
    team_for_employee TEXT;
    employee_name TEXT;
    employee_email TEXT;
    hire_date_for_employee DATE;

BEGIN

    FOR i IN 1..350 LOOP

        --------------------------------------------------------
        -- DISTRIBUIÇÃO DOS PAÍSES
        --
        -- Brasil:   180
        -- EUA:       90
        -- Inglaterra:50
        -- Espanha:   30
        --------------------------------------------------------

        IF i <= 180 THEN
            country_for_employee := 'Brasil';
            region_for_employee := 'LATAM';

        ELSIF i <= 270 THEN
            country_for_employee := 'EUA';
            region_for_employee := 'NA';

        ELSIF i <= 320 THEN
            country_for_employee := 'Inglaterra';
            region_for_employee := 'EMEA';

        ELSE
            country_for_employee := 'Espanha';
            region_for_employee := 'EMEA';
        END IF;


        --------------------------------------------------------
        -- DEPARTAMENTOS
        --
        -- Criamos propositalmente algumas combinações pequenas.
        --
        -- Espanha + Jurídico terá somente 3 pessoas:
        -- IDs 321, 322 e 323
        --
        -- Isso permite testar diretamente o HAVING >= 5.
        --------------------------------------------------------

        IF i IN (321, 322, 323) THEN
            department_for_employee := 'Jurídico';

        ELSIF i BETWEEN 324 AND 350 THEN
            -- Espanha sem Jurídico
            department_for_employee :=
                departments[((i - 324) % 7) + 1];

            -- pula Jurídico
            IF department_for_employee = 'Jurídico' THEN
                department_for_employee := 'Operações';
            END IF;

        ELSE
            department_for_employee :=
                departments[((i * 3) % 8) + 1];
        END IF;


        --------------------------------------------------------
        -- TIMES
        --------------------------------------------------------

        team_for_employee :=
            CASE ((i - 1) % 5)
                WHEN 0 THEN 'Team Alpha'
                WHEN 1 THEN 'Team Beta'
                WHEN 2 THEN 'Team Gamma'
                WHEN 3 THEN 'Team Delta'
                ELSE 'Team Omega'
            END;


        --------------------------------------------------------
        -- NOMES
        --------------------------------------------------------

        employee_name :=
            first_names[((i - 1) % array_length(first_names, 1)) + 1]
            || ' '
            || last_names[((i * 7) % array_length(last_names, 1)) + 1];


        --------------------------------------------------------
        -- EMAIL
        --------------------------------------------------------

        employee_email :=
            'employee' || LPAD(i::TEXT, 3, '0') || '@company.example';


        --------------------------------------------------------
        -- DATA DE ADMISSÃO
        --
        -- Entre 2019 e 2026.
        --------------------------------------------------------

        hire_date_for_employee :=
            DATE '2019-01-01'
            + ((i * 37) % 2555);


        INSERT INTO respondents (
            name,
            email,
            country,
            region,
            department,
            team,
            hire_date
        )
        VALUES (
            employee_name,
            employee_email,
            country_for_employee,
            region_for_employee,
            department_for_employee,
            team_for_employee,
            hire_date_for_employee
        );

    END LOOP;

END $$;


-- ============================================================
-- 2. QUESTIONÁRIOS
-- ============================================================

INSERT INTO questionnaires (title, period)
VALUES
    ('Pesquisa de Experiência do Colaborador - Março 2026', '2026-03'),
    ('Pesquisa de Experiência do Colaborador - Abril 2026', '2026-04'),
    ('Pesquisa de Experiência do Colaborador - Maio 2026', '2026-05'),
    ('Pesquisa de Experiência do Colaborador - Junho 2026', '2026-06'),
    ('Pesquisa de Experiência do Colaborador - Julho 2026', '2026-07'),
    ('Pesquisa de Experiência do Colaborador - Agosto 2026', '2026-08');


-- ============================================================
-- 3. PERGUNTAS
-- ============================================================

INSERT INTO questions (
    text,
    category,
    subcategory,
    polarity
)
VALUES

-- Carga de trabalho
(
    'Com que frequência você precisou trabalhar além do horário?',
    'Carga de trabalho',
    'Horas extras',
    'negative'
),
(
    'Com que frequência você recebeu ou precisou cumprir prazos irreais?',
    'Carga de trabalho',
    'Prazos',
    'negative'
),
(
    'Com que frequência você conseguiu fazer suas pausas adequadamente?',
    'Carga de trabalho',
    'Pausas',
    'positive'
),

-- Relação com liderança
(
    'Com que frequência você teve desentendimentos com seu gestor?',
    'Relação com liderança',
    'Conflitos',
    'negative'
),
(
    'Com que frequência você recebeu feedback do seu gestor?',
    'Relação com liderança',
    'Feedback',
    'positive'
),
(
    'Com que frequência você pôde discordar do seu gestor sem receio?',
    'Relação com liderança',
    'Segurança psicológica',
    'positive'
),

-- Reconhecimento e crescimento
(
    'Com que frequência seu trabalho foi reconhecido?',
    'Reconhecimento e crescimento',
    'Reconhecimento',
    'positive'
),
(
    'Com que frequência você teve conversas sobre seu desenvolvimento de carreira?',
    'Reconhecimento e crescimento',
    'Desenvolvimento',
    'positive'
),
(
    'Com que frequência você sentiu que estava estagnado profissionalmente?',
    'Reconhecimento e crescimento',
    'Estagnação',
    'negative'
),

-- Equilíbrio vida-trabalho
(
    'Com que frequência você precisou cancelar compromissos pessoais por causa do trabalho?',
    'Equilíbrio vida-trabalho',
    'Vida pessoal',
    'negative'
),
(
    'Com que frequência você conseguiu se desconectar do trabalho nos fins de semana?',
    'Equilíbrio vida-trabalho',
    'Desconexão',
    'positive'
),
(
    'Com que frequência você percebeu sinais de esgotamento relacionados ao trabalho?',
    'Equilíbrio vida-trabalho',
    'Esgotamento',
    'negative'
);


-- ============================================================
-- 4. OPÇÕES DE RESPOSTA
-- ============================================================
--
-- A escala é a mesma para todas as perguntas.
--
-- Para perguntas negativas:
-- 1 = Nunca     -> score positivo após inversão = 5
-- 5 = Sempre    -> score positivo após inversão = 1
--
-- Para perguntas positivas:
-- 1 = Nunca
-- 5 = Sempre
-- ============================================================

INSERT INTO response_options (
    question_id,
    label,
    scale_value
)
SELECT
    q.id,
    option_data.label,
    option_data.scale_value
FROM questions q
CROSS JOIN (
    VALUES
        ('Nunca', 1),
        ('Raramente', 2),
        ('Às vezes', 3),
        ('Frequentemente', 4),
        ('Sempre', 5)
) AS option_data(label, scale_value);


-- ============================================================
-- 5. RESPOSTAS
-- ============================================================
--
-- Cada funcionário tem aproximadamente 82% de chance
-- de responder cada mês.
--
-- Portanto:
--   350 funcionários
--   ~287 respondentes/mês
--   12 meses
--   12 perguntas
--
-- Aproximadamente:
--  20.700 respostas
--
-- A participação é determinística baseada no ID, evitando
-- que uma nova execução gere um dataset completamente
-- diferente.
-- ============================================================

INSERT INTO responses (
    respondent_id,
    questionnaire_id,
    question_id,
    option_id,
    submitted_at
)
SELECT
    r.id AS respondent_id,
    qn.id AS questionnaire_id,
    q.id AS question_id,

    ro.id AS option_id,

    (
        DATE_TRUNC(
            'month',
            TO_DATE(qn.period || '-01', 'YYYY-MM-DD')
        )
        + INTERVAL '15 days'
        + (
            ((r.id * 13 + qn.id * 17 + q.id * 7) % 20)
            * INTERVAL '1 hour'
        )
    )::TIMESTAMP AS submitted_at

FROM respondents r
CROSS JOIN questionnaires qn
CROSS JOIN questions q

JOIN response_options ro
    ON ro.question_id = q.id

WHERE
    ------------------------------------------------------------
    -- Cada funcionário responde aproximadamente 82% dos meses.
    --
    -- O cálculo utiliza respondent_id + questionnaire_id para
    -- variar a participação entre os meses.
    ------------------------------------------------------------
    (
        (r.id * 31 + qn.id * 17) % 100
    ) < 82

    ------------------------------------------------------------
    -- Seleciona uma única opção para cada resposta.
    --
    -- O resultado fica entre 1 e 5.
    ------------------------------------------------------------
    AND ro.scale_value =
        (
            (
                r.id * 11
                + qn.id * 7
                + q.id * 13
            ) % 5
        ) + 1;



COMMIT;