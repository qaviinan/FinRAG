# FinRAG - AI Financial Advisor

## Overview

FinRAG is an AI-powered financial advisor application designed to provide personalized comparative analysis of retail investment schemes. The application consists of a **React** frontend and a **Django** backend, offering users an intuitive interface to explore and receive tailored investment recommendations based on their queries.

## Features

### Frontend
- **React Framework:** Delivers a dynamic and responsive user interface.
- **User-Friendly Interface:** Simplifies navigation and interaction for users seeking investment advice.
- **API Integration:** Communicates seamlessly with the Django backend to fetch and display investment data.
- **Optimized Performance:** Ensures fast load times and smooth user experience through efficient rendering.

### Backend
- **Django Framework:** Provides a robust and scalable backend infrastructure.
- **AI-Powered Recommendations:** Utilizes AI to analyze and recommend investment schemes based on user input.
- **Data Processing:** Automates the ingestion and transformation of investment scheme data from CSV files.
- **RESTful APIs:** Offers secure and efficient endpoints for frontend communication.
- **CORS Support:** Configured with `django-cors-headers` to facilitate cross-origin requests from the frontend.

## Prerequisites

Ensure the following are installed on your machine:

- **Environment Management Tool:** [Conda](https://docs.conda.io/en/latest/) or a similar tool.
- **Python:** Version 3.8 or higher.
- **Node.js:** Version 14.x or higher.
- **npm or Yarn:** Package managers for JavaScript.
- **Git:** For cloning repositories.
- **Docker:** (Optional) For containerized deployment.

## Project Structure

```
finrag/
├── backend/
│   ├── config/                 # Django project settings
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── schemes/               # Django app
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── utils.py
│   ├── cleaner/               # Data processing scripts
│   │   └── scheme_data_transformer.py
│   ├── data/                  # Raw CSV files
│   ├── clean/                 # Processed CSV files
│   ├── manage.py
│   ├── chat_config.py         # Embedchain configuration
│   ├── requirements.txt
│   └── Dockerfile             # Docker configuration for backend
├── frontend/
│   ├── components/            # Reusable React components
│   ├── pages/                 # React pages
│   │   ├── api/               # API routes (if any)
│   │   ├── hotels.js          # Example page for hotels
│   │   └── index.js           # Home page
│   ├── public/                # Static assets
│   ├── src/                   # Source files
│   ├── .env.local             # Environment variables
│   ├── package.json
│   ├── README.md              # Frontend-specific README
│   └── Dockerfile             # Docker configuration for frontend
├── .gitignore
└── README.md                  # Combined project README
```

## Setup Instructions

Follow the steps below to set up both the backend and frontend components of FinRAG.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/finrag.git
cd finrag
```

### 2. Backend Setup

#### 2.1. Create and Activate Conda Environment

Create a new Conda environment with Python 3.11 and activate it.

```bash
conda create -n backend-env python=3.11 -y
conda activate backend-env
```

#### 2.2. Install Dependencies

Navigate to the backend directory and install the required Python packages.

```bash
cd backend
pip install -r requirements.txt
```

#### 2.3. Set Up Environment Variables

Create a `.env` file in the `backend` directory and add the necessary environment variables.

```bash
echo "DEBUG=True" > .env
echo "SECRET_KEY=your-secret-key" >> .env
echo "DATABASE_URL=your-database-url" >> .env
echo "OPENAI_API_KEY=\"<YOUR_OPENAI_API_KEY>\"" >> .env
echo "GROQ_API_KEY=\"<YOUR_GROQ_API_KEY>\"" >> .env
echo "CHROMA_BOOKS_COLLECTION=\"finbooks\"" >> .env
echo "CHROMA_DB_PATH=\"chromadb\"" >> .env
```

*Replace `<YOUR_OPENAI_API_KEY>`, `<YOUR_GROQ_API_KEY>`, and other placeholders with your actual credentials.*

#### 2.4. Apply Migrations

Set up the database by applying Django migrations.

```bash
python manage.py makemigrations
python manage.py migrate
```

#### 2.5. Run the Backend Application

Start the Django development server.

```bash
python manage.py runserver 0.0.0.0:8001
```

*Alternatively, use Gunicorn for production environments:*

```bash
gunicorn -w 2 -b 0.0.0.0:8001 config.wsgi:application
```

### 3. Frontend Setup

#### 3.1. Navigate to Frontend Directory

Open a new terminal window and navigate to the frontend directory.

```bash
cd ../frontend
```

#### 3.2. Install Dependencies

Use your preferred package manager to install the necessary packages.

##### Using npm:

```bash
npm install
```

##### Using Yarn:

```bash
yarn install
```

#### 3.3. Configure Environment Variables

Create a `.env.local` file in the `frontend` directory and add any necessary environment variables, such as API endpoints.

```bash
echo "REACT_APP_API_URL=http://localhost:8001/api" > .env.local
```

*Adjust the `REACT_APP_API_URL` as needed for your setup.*

#### 3.4. Run the Frontend Application

Start the React development server.

##### Using npm:

```bash
npm start
```

##### Using Yarn:

```bash
yarn start
```

Open [http://localhost:3000/hotels](http://localhost:3000/hotels) in your browser to view the application.

*For production builds:*

```bash
npm run build
npm run start
```

### 4. Dockerized Deployment (Optional)

If you prefer containerized deployment, Dockerfiles are provided for both backend and frontend.

#### 4.1. Backend Docker Setup

Navigate to the backend directory and build the Docker image.

```bash
cd backend
docker build -t finrag-backend .
```

Run the Docker container.

```bash
docker run --rm \
    -v $(pwd)/chroma.sqlite3:/app/chromadb/chroma.sqlite3 \
    -v $(pwd)/.env:/app/.env \
    -p 8001:8001 \
    finrag-backend
```

#### 4.2. Frontend Docker Setup

Open a new terminal window, navigate to the frontend directory, and build the Docker image.

```bash
cd ../frontend
docker build -t finrag-frontend .
```

Run the Docker container.

```bash
docker run --rm \
    -v $(pwd)/public:/app/public \
    -v $(pwd)/.env.local:/app/.env.local \
    -p 3000:3000 \
    finrag-frontend
```

Access the frontend at [http://localhost:3000/hotels](http://localhost:3000/hotels).

## API Endpoints

### Investment Advice

- **URL:** `/api/advice/`
- **Method:** `POST`
- **Description:** Provides AI-powered investment scheme recommendations based on user queries.
- **Request Body:**

  ```json
  {
      "query": "Find low-risk investment schemes with high returns."
  }
  ```

- **Response:**

  ```json
  {
      "filters": ["risk_level", "returns_3yr", "expense_ratio"],
      "schemes": [
          {
              "scheme_id": "SC12345",
              "name": "Stable Growth Fund",
              "category": "Equity",
              "risk_level": "Low",
              "min_investment": 1000,
              "returns_3yr": 5.5,
              "returns_5yr": 6.2,
              "expense_ratio": 0.75,
              "fund_size": 5000000,
              "fund_manager": "John Doe",
              "description": "A low-risk equity fund focusing on stable growth."
          }
          // More schemes...
      ]
  }
  ```

### Test Data Endpoint

- **URL:** `/api/test/`
- **Method:** `GET`
- **Description:** Returns a confirmation message to verify that the backend is operational.
- **Response:**

  ```json
  {
      "message": "Backend is running smoothly!"
  }
  ```

## Data Setup

1. **Place CSV Files:**
   - Add your investment scheme CSV files to the `backend/data/` directory.

2. **Process Data:**
   - Run the data transformer to process the CSV files.

   ```bash
   python cleaner/scheme_data_transformer.py --data data/ --clean clean/
   ```

   *This script will transform raw CSV data into a format suitable for the application.*

## Testing

Ensure that both frontend and backend components function correctly by performing the following tests.

### Backend Testing

Navigate to the backend directory and run Django tests.

```bash
cd backend
python manage.py test
```

### Frontend Testing

Navigate to the frontend directory and run tests using your package manager.

##### Using npm:

```bash
npm test
```

##### Using Yarn:

```bash
yarn test
```

## Contributing

Contributions are welcome to enhance the functionality and features of FinRAG. Follow the guidelines below to contribute effectively.

### How to Contribute

1. **Fork the Repository**
2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeature
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m "Add Your Feature"
   ```

4. **Push to Your Fork**

   ```bash
   git push origin feature/YourFeature
   ```

5. **Open a Pull Request**

   Navigate to the original repository and click the "Compare & pull request" button to submit your changes.

### Coding Standards

- **Python (Backend):**
  - Follow [PEP 8](https://pep8.org/) style guidelines.
  - Write clear and concise commit messages.
  - Include tests for new features or bug fixes.
  - Update documentation as necessary.

- **JavaScript (Frontend):**
  - Adhere to best practices for React development.
  - Maintain consistent code formatting.
  - Include unit and integration tests for new components and features.
  - Update documentation as necessary.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For any questions, suggestions, or support, please reach out to:

**Qavi Inan** - [qaviinan@gmail.com](mailto:qaviinan@gmail.com)
