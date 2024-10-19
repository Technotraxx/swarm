import os
import logging
from typing import Dict, Any
import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI
from firecrawl import FirecrawlApp
from swarm import Agent
from swarm.repl import run_demo_loop
from serpapi import GoogleSearch

# Load environment variables
load_dotenv()

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
            model="gpt-4o",
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
        st.info(f"Searching Google for: {query}")
        search = GoogleSearch({
            "q": query,
            "api_key": serp_api_key  # Use the API key from Streamlit input
        })
        results = search.get_dict()
        st.info(f"Raw SerpAPI results: {results}")
        organic_results = results.get("organic_results", [])
        if not organic_results:
            st.warning("No organic results found in the SerpAPI response.")
        return {"objective": objective, "results": organic_results}
    except Exception as e:
        st.error(f"Error searching Google: {str(e)}")
        return {"objective": objective, "results": [], "error": str(e)}
        
def map_url_pages(url: str, objective: str) -> Dict[str, Any]:
    """Map a website's pages using Firecrawl."""
    try:
        st.info(f"Mapping URL: {url}")
        search_query = generate_completion(
            "website search query generator",
            f"Generate a 1-2 word search query for the website: {url} based on the objective",
            f"Objective: {objective}"
        )
        st.info(f"Generated search query: {search_query}")
        map_status = app.map_url(url, params={"search": search_query})
        st.info(f"Firecrawl map_url response: {map_status}")
        
        if map_status.get('success') == True:  # Changed from 'status' to 'success'
            links = map_status.get('links', [])
            top_link = links[0] if links else None
            st.success(f"Mapping successful. Found {len(links)} links.")
            return {"objective": objective, "results": [top_link] if top_link else []}
        else:
            error_message = map_status.get('message', 'Unknown error')
            st.error(f"Firecrawl mapping failed: {error_message}")
            return {"objective": objective, "results": [], "error": f"Mapping failed: {error_message}"}
    except Exception as e:
        st.error(f"Error mapping URL pages: {str(e)}")
        return {"objective": objective, "results": [], "error": str(e)}

def scrape_url(url: str, objective: str) -> Dict[str, Any]:
    """Scrape a website using Firecrawl."""
    try:
        st.info(f"Scraping URL: {url}")
        scrape_status = app.scrape_url(
            url,
            params={'formats': ['markdown']}
        )
        st.info(f"Firecrawl scrape_url response received.")
        
        if isinstance(scrape_status, dict) and 'markdown' in scrape_status:
            markdown_content = scrape_status['markdown']
            if markdown_content:
                st.success("Successfully scraped content.")
                return {"objective": objective, "results": markdown_content}
            else:
                st.warning("No markdown content found in the scrape results.")
                return {"objective": objective, "results": None, "error": "No content scraped"}
        else:
            st.error(f"Unexpected response format from Firecrawl API: {scrape_status}")
            return {"objective": objective, "results": None, "error": "Unexpected API response format"}
    except Exception as e:
        st.error(f"Error scraping URL: {str(e)}")
        return {"objective": objective, "results": None, "error": str(e)}

def analyze_website_content(content: str, objective: str) -> Dict[str, Any]:
    """Analyze the scraped website content using OpenAI."""
    try:
        if not content:
            return {"objective": objective, "results": None, "error": "No content to analyze"}
        
        analysis = generate_completion(
            "data analyst",
            f"Analyze the following website content and extract key insights based on the objective.",
            f"Objective: {objective}\n\nContent: {content[:8000]}"  # Limit content to 4000 characters to avoid token limits
        )
        
        # Attempt to parse the analysis as JSON, but fall back to string if it fails
        try:
            analysis_results = json.loads(analysis)
        except json.JSONDecodeError:
            analysis_results = {"analysis": analysis}
        
        return {"objective": objective, "results": analysis_results}
    except Exception as e:
        st.error(f"Error analyzing website content: {str(e)}")
        return {"objective": objective, "results": None, "error": str(e)}

def main():
    st.header("Web Data Extraction")
    
    objective = st.text_input("Enter your web data extraction objective:")
    url = st.text_input("Enter the URL to analyze:")
    
    if st.button("Start Analysis"):
        if not objective or not url:
            st.warning("Please enter both an objective and a URL.")
            return
        
        with st.spinner("Processing..."):
            # Scrape URL
            scrape_results = scrape_url(url, objective)
            if scrape_results.get("error"):
                st.error(f"Error in scraping URL: {scrape_results['error']}")
                return
            
            if not scrape_results.get("results"):
                st.error("No content was scraped from the URL.")
                return
            
            # Analyze content
            analysis_results = analyze_website_content(scrape_results["results"], objective)
            if analysis_results.get("error"):
                st.error(f"Error in analyzing content: {analysis_results['error']}")
                return
            
            # Display results
            st.success("Analysis complete!")
            st.subheader("Analysis Results")
            st.json(analysis_results["results"])

if __name__ == "__main__":
    main()
