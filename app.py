import os
from firecrawl import FirecrawlApp
from swarm import Agent
from swarm.repl import run_demo_loop
import dotenv
from serpapi import GoogleSearch
from openai import OpenAI

dotenv.load_dotenv()
# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Streamlit app title
st.title("Web Scraping and Analysis App")

# Sidebar for API key inputs
st.sidebar.header("API Keys")
firecrawl_api_key = st.sidebar.text_input("Firecrawl API Key", type="password")
openai_api_key = st.sidebar.text_input("OpenAI API Key", type="password")
serp_api_key = st.sidebar.text_input("SERP API Key", type="password")

# Initialize FirecrawlApp and OpenAI if API keys are provided
if firecrawl_api_key and openai_api_key and serp_api_key:
    app = FirecrawlApp(api_key=firecrawl_api_key)
    client = OpenAI(api_key=openai_api_key)
else:
    st.warning("Please enter all API keys in the sidebar to use the app.")
    st.stop()

def generate_completion(role: str, task: str, content: str) -> str:
    """Generate a completion using OpenAI."""
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are a {role}. {task}"},
                {"role": "user", "content": content}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        st.error(f"Error generating completion: {e}")
        return ""

def search_google(query: str, objective: str) -> Dict[str, Any]:
    """Search Google using SerpAPI."""
    try:
        search = GoogleSearch({
            "q": query,
            "api_key": os.getenv("SERP_API_KEY")
        })
        results = search.get_dict().get("organic_results", [])
        return {"objective": objective, "results": results}
    except Exception as e:
        logging.error(f"Error searching Google: {e}")
        return {"objective": objective, "results": [], "error": str(e)}

def map_url_pages(url: str, objective: str) -> Dict[str, Any]:
    """Map a website's pages using Firecrawl."""
    try:
        search_query = generate_completion(
            "website search query generator",
            f"Generate a 1-2 word search query for the website: {url} based on the objective",
            f"Objective: {objective}"
        )
        map_status = app.map_url(url, params={"search": search_query})
        if map_status.get('status') == 'success':
            links = map_status.get('links', [])
            top_link = links[0] if links else None
            return {"objective": objective, "results": [top_link] if top_link else []}
        else:
            return {"objective": objective, "results": [], "error": "Mapping failed"}
    except Exception as e:
        st.error(f"Error mapping URL pages: {e}")
        return {"objective": objective, "results": [], "error": str(e)}

def scrape_url(url: str, objective: str) -> Dict[str, Any]:
    """Scrape a website using Firecrawl."""
    try:
        scrape_status = app.scrape_url(
            url,
            params={'formats': ['markdown']}
        )
        return {"objective": objective, "results": scrape_status}
    except Exception as e:
        st.error(f"Error scraping URL: {e}")
        return {"objective": objective, "results": None, "error": str(e)}

def analyze_website_content(content: str, objective: str) -> Dict[str, Any]:
    """Analyze the scraped website content using OpenAI."""
    try:
        analysis = generate_completion(
            "data analyst",
            f"Analyze the following website content and extract key insights based on the objective.",
            content
        )
        return {"objective": objective, "results": json.loads(analysis)}
    except json.JSONDecodeError as e:
        st.error(f"Error decoding JSON from analysis: {e}")
        return {"objective": objective, "results": None, "error": f"Invalid JSON returned from OpenAI: {e}"}
    except Exception as e:
        st.error(f"Error analyzing website content: {e}")
        return {"objective": objective, "results": None, "error": str(e)}

# Main app logic
def main():
    st.header("Web Data Extraction")
    
    objective = st.text_input("Enter your web data extraction objective:")
    url = st.text_input("Enter the URL to analyze (optional):")
    
    if st.button("Start Analysis"):
        if not objective:
            st.warning("Please enter an objective.")
            return
        
        with st.spinner("Processing..."):
            if not url:
                # Perform Google search
                search_results = search_google(objective, objective)
                if search_results.get("error"):
                    st.error(f"Error in Google search: {search_results['error']}")
                    return
                url = search_results["results"][0]["link"] if search_results["results"] else None
                if not url:
                    st.warning("No results found from Google search.")
                    return
                st.info(f"Analyzing URL: {url}")
            
            # Map URL pages
            map_results = map_url_pages(url, objective)
            if map_results.get("error"):
                st.error(f"Error in mapping URL: {map_results['error']}")
                return
            
            # Scrape URL
            scrape_results = scrape_url(url, objective)
            if scrape_results.get("error"):
                st.error(f"Error in scraping URL: {scrape_results['error']}")
                return
            
            # Analyze content
            analysis_results = analyze_website_content(scrape_results["results"]["content"], objective)
            if analysis_results.get("error"):
                st.error(f"Error in analyzing content: {analysis_results['error']}")
                return
            
            # Display results
            st.success("Analysis complete!")
            st.subheader("Analysis Results")
            st.json(analysis_results["results"])

if __name__ == "__main__":
    main()
