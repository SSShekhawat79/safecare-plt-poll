# PLT Live Poll

Live audience polling for SAFECARE PLT sessions, with AI summaries from Claude through the Netlify AI Gateway.

## Pages
- `/vote`: attendees join here by scanning the QR code. Anonymous, no login.
- `/present`: projector screen. Needs the presenter PIN.
- `/report`: end-of-session report. Print it, save it as a PDF or download a CSV.

## Presenter controls
These sit at the bottom of the screen and fade out when you're not using them; move the mouse to bring them back.
- **Prev / Next** (or the arrow keys): change question. Moving to a question opens voting for it.
- **Close voting / Open voting**: stop or restart voting on the current question.
- **Reveal answer**: highlights the correct option on knowledge questions.
- **Analyse with AI**: summarises the current question on screen.
- **Session summary**: writes a summary of the whole session.
- **New session**: clears the screen to start a fresh session. Results from earlier sessions are kept in storage.

## Changing the questions
Edit `lib/questions.mjs`, then redeploy. The file explains each question type: mcq, rating, wordcloud and text.

## Presenter PIN
The default PIN is set in `lib/store.mjs`. To change it without editing code, add an environment variable called `PRESENTER_PIN` in Netlify (Project configuration > Environment variables), then redeploy.
