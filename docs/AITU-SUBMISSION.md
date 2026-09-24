# AITU AI StartUp Projects — submission draft

Use the wording below for the current demonstration stage. Replace the bracketed contact and link fields yourself. Do not claim live AI verification until an actual request has completed successfully with your API key.

## 1. Name of the Project

**SaqTender AI — Procurement Compliance Agent**

## 2. What is your project about, and what problem does it solve?

SaqTender AI is a procurement decision-support prototype for construction and engineering companies participating in tenders in Kazakhstan.

Tender specialists need to compare tender requirements with company documents while tracking several deadlines. Missing evidence, incomplete documents or overlooked submission dates can put an application at risk. Our prototype brings these checks into one workflow: a company document profile, tender analysis, an evidence-based requirements matrix, potential gaps, recommended actions and draft reminders.

The current demonstration uses a fictional company and a fictional school-construction tender. It supports human review and does not determine official eligibility.

## 3. How is AI used in the project, and what stage are you currently at?

The prototype includes a server-side integration with the OpenAI Agents SDK. The compliance agent is designed to extract requirements and deadlines from supplied tender text, retrieve the demo company profile through a tool, compare the available evidence and produce a structured assessment with draft alerts. Each requirement and deadline includes a source snippet, and insufficient evidence is marked as unknown.

We are at the demo-MVP stage. The app also provides a clearly labeled deterministic Demo Mode that works without an API key. The live AI integration still requires an end-to-end run with an API key before we claim it as verified. Official procurement data access, real company pilots and production monitoring remain future work.

After a successful live check, replace only the sentence about verification with: “We have verified the live AI workflow using a fictional sample tender.” Do not imply that a successful sample run validates legal correctness or production readiness.

## 4. What results have you achieved?

We have implemented a demonstration workflow with a company document profile, editable tender input, structured requirements and deadline assessment, source evidence, recommended actions and draft alert records. The prototype supports deterministic Demo Mode and includes a server-side AI integration.

We have not yet validated the product with real customer pilots and do not claim users, revenue, competition awards or measured business impact. Our next milestone is to test the workflow with procurement specialists and measure extraction accuracy, review time and usefulness of the identified document gaps.

## 5. Presentation/Video

Attach a short recording of the working sample workflow. State **Demo Mode** clearly if the recording uses deterministic analysis. A presentation has not been created as part of this code deliverable; do not claim an attached deck unless you attach one.

Suggested recording sequence: company profile → sample tender → run analysis → evidence and missing work-experience document → deadline and draft reminders → limitations and next milestone.

## 6. Project link

**[Replace with the deployed, accessible application URL after testing it.]**

Optionally add the public repository URL if available. A local `localhost` URL or a placeholder is not a usable submission link. Open the deployment in a private browser window to confirm reviewers can access it.

## 7. Contact details

**Nurzhigit [add your full name] — Telegram: [your handle] / Phone: [your number]**

## Russian demo script — approximately 90 seconds

«SaqTender AI — это прототип помощника для компаний, которые участвуют в тендерах в Казахстане. Мы начинаем со строительных и инженерных компаний.

Проблема в том, что специалисту нужно одновременно следить за требованиями тендера, документами компании и несколькими сроками. Ошибка или отсутствующее подтверждение могут поставить заявку под риск.

Покажу один полный сценарий. Здесь вымышленная компания OrdaBuild Demo LLP: лицензия, экспертное заключение, финансовый отчёт и незаполненное подтверждение опыта. Справа — вымышленный тендер на строительство школы. Его текст можно отредактировать.

Нажимаю проверку. В этой записи используется Demo Mode: он демонстрирует сценарий без обращения к модели. В проекте также подготовлена серверная интеграция с OpenAI Agents SDK.

Получаем таблицу требований. Для каждого пункта видна цитата из тендера и объяснение по данным компании. Например, тендер требует подтверждённый опыт, а в профиле соответствующий документ отсутствует. Это даёт специалисту конкретное действие перед подачей.

Отдельно видны сроки подачи и обеспечения заявки. Система создаёт черновики напоминаний за семь дней, три дня и сутки. Они пока никуда не отправляются.

Это поддержка решения, а не официальная проверка допуска. Следующий шаг — проверить качество извлечения и пользу сценария с тендерными специалистами».

If recording verified live mode, replace the Demo Mode sentence with: «Сейчас выполняется реальный запрос к модели. Агент получает профиль компании через инструмент и возвращает структурированный результат с доказательствами из текста». Use that wording only after verifying the actual live run shown in the recording.

## Final submission checks

- The project name is a working title; no trademark clearance is claimed.
- The mode shown in the recording matches the mode described in the form.
- The project URL is real and accessible without a local server.
- Fictional data, draft-only alerts and unverified official eligibility remain visible.
- Contact details are complete, and any presentation or recording mentioned is actually attached.
- No customer numbers, accuracy metrics or legal/commercial data-access claims have been invented.

## Project source

[GitHub repository](https://github.com/Nurzhigittt/SaqTender-AI-Procurement-Compliance-Agent)

A public app URL can be added after Vercel deployment. Do not use localhost as the public project link.
