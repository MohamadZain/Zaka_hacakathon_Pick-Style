# Pick&Style — AI Visual Shopping Assistant

> **We compare. You decide.**

Fetch is an AI-powered visual shopping assistant that helps users turn an image of something they like into relevant shopping options.

Upload a look, choose the items you want, add your sizes and budget, and compare different options across retailers.

## Features

- Visual shopping from an uploaded image
- Select the specific items you want
- Individual size selection for each item
- Budget-based recommendations
- Multi-item shopping comparisons
- Closest Match, Best Value, and Best Price options
- Online and in-store shopping options
- Product comparison with retailer and price information
- Budget recalculation

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Python + Flask
- **Data:** JSON-based product catalog
- **Database:** None

## Run Locally

Create and activate a virtual environment:

```bash
py -m venv venv
venv\Scripts\activate
````

Install dependencies:

```bash
py -m pip install -r requirements.txt
```

Run the application:

```bash
py app.py
```

Open:

[http://127.0.0.1:5000](http://127.0.0.1:5000)

## Project Structure

```text
ai-shop/
├── app.py
├── requirements.txt
├── data/
├── templates/
└── static/
    ├── css/
    ├── js/
    └── images/
```

## Project Flow

```text
Upload Image
      ↓
Select Items
      ↓
Choose Sizes
      ↓
Set Budget
      ↓
Analyze & Find Options
      ↓
Compare Results
      ↓
Recalculate
```

## Status

This project is a hackathon prototype focused on demonstrating the visual shopping experience and recommendation workflow.

## License

This project was created for a hackathon prototype.
