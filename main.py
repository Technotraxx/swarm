import streamlit as st
from firecrawl import FirecrawlApp
from swarm import Agent
from openai import OpenAI

# Streamlit App Layout
st.set_page_config(
    page_title="Editorial News Assistant",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📰 Editorial News Assistant")
st.markdown("""
Welcome to the **Editorial News Assistant**! Enter the URL of a news article, and our assistant will generate a comprehensive editorial piece for you by scraping, analyzing, fact-checking, summarizing, and editing the content.
""")

# Sidebar for API Key Inputs
st.sidebar.header("API Configuration")

firecrawl_api_key = st.sidebar.text_input(
    "Firecrawl API Key",
    type="password",
    help="Enter your Firecrawl API key here."
)

openai_api_key = st.sidebar.text_input(
    "OpenAI API Key",
    type="password",
    help="Enter your OpenAI API key here."
)

# Initialize FirecrawlApp and OpenAI only if API keys are provided
if firecrawl_api_key and openai_api_key:
    try:
        app = FirecrawlApp(api_key=firecrawl_api_key)
        client = OpenAI(api_key=openai_api_key)
    except Exception as e:
        st.sidebar.error(f"Failed to initialize APIs: {str(e)}")
        st.stop()
else:
    st.sidebar.warning("Please enter both Firecrawl and OpenAI API keys to proceed.")
    st.stop()

def scrape_website(url):
    """Scrape a website using Firecrawl."""
    try:
        scrape_status = app.scrape_url(
            url,
            params={'formats': ['markdown']}
        )
        st.write("🔍 Scrape Status Response:", scrape_status)  # Debugging statement
        if 'status' not in scrape_status:
            raise KeyError("'status' key is missing in the scrape response.")
        if scrape_status['status'] != 'success':
            raise Exception(f"Scraping failed: {scrape_status.get('error', 'Unknown error')}")
        return scrape_status['content']
    except Exception as e:
        st.error(f"An error occurred during scraping: {str(e)}")
        return None

def generate_completion(role, task, content):
    """Generate a completion using OpenAI."""
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are a {role}. {task}"},
                {"role": "user", "content": content}
            ]
        )
        completion = response.choices[0].message.content.strip()
        return completion
    except Exception as e:
        st.error(f"An error occurred while generating completion: {str(e)}")
        return None

def analyze_website_content(content):
    """Analyze the scraped website content for key insights."""
    analysis = generate_completion(
        "content analyst",
        "Analyze the following news content and provide key insights, including relevance, significance, and potential impact.",
        content
    )
    if not analysis:
        st.error("Failed to analyze content.")
    return analysis

def fact_check_content(content):
    """Fact-check the provided content."""
    fact_check = generate_completion(
        "fact checker",
        "Verify the factual accuracy of the following news content. Highlight any discrepancies or confirm the validity of the information.",
        content
    )
    if not fact_check:
        st.error("Failed to fact-check content.")
    return fact_check

def summarize_content(content):
    """Summarize the news content."""
    summary = generate_completion(
        "summarizer",
        "Provide a concise summary of the following news article.",
        content
    )
    if not summary:
        st.error("Failed to summarize content.")
    return summary

def generate_editorial(analysis, fact_check, summary):
    """Generate an editorial piece based on analysis, fact-check, and summary."""
    if not all([analysis, fact_check, summary]):
        st.error("Missing components for editorial generation.")
        return None
    editorial = generate_completion(
        "editor",
        "Compose a well-structured editorial article using the following analysis, fact-check results, and summary.",
        f"Analysis: {analysis}\nFact Check: {fact_check}\nSummary: {summary}"
    )
    if not editorial:
        st.error("Failed to generate editorial.")
    return editorial

# Define Agents

def handoff_to_scraper():
    """Hand off the URL to the website scraper agent."""
    return website_scraper_agent

def handoff_to_analyzer():
    """Hand off the scraped content to the content analyzer agent."""
    return content_analyzer_agent

def handoff_to_fact_checker():
    """Hand off the content to the fact checker agent."""
    return fact_checker_agent

def handoff_to_summarizer():
    """Hand off the content to the summarizer agent."""
    return summarizer_agent

def handoff_to_editor():
    """Hand off the analyzed and summarized content to the editor agent."""
    return editor_agent

user_interface_agent = Agent(
    name="User Interface Agent",
    instructions=(
        "You are a user interface agent that manages interactions with the user. "
        "Begin by requesting a URL of a news website that the user wants to create an editorial for. "
        "Ask any necessary clarification questions. Be clear and concise."
    ),
    functions=[handoff_to_scraper],
)

website_scraper_agent = Agent(
    name="Website Scraper Agent",
    instructions="You are a website scraper agent specialized in extracting content from news websites.",
    functions=[scrape_website, handoff_to_analyzer],
)

content_analyzer_agent = Agent(
    name="Content Analyzer Agent",
    instructions=(
        "You are a content analyzer agent that examines scraped news content for key insights and relevance. "
        "Provide a thorough analysis to aid in editorial creation. Be concise."
    ),
    functions=[analyze_website_content, handoff_to_fact_checker],
)

fact_checker_agent = Agent(
    name="Fact Checker Agent",
    instructions=(
        "You are a fact checker agent responsible for verifying the accuracy of the news content. "
        "Identify and highlight any discrepancies or confirm the validity of the information. Be precise."
    ),
    functions=[fact_check_content, handoff_to_summarizer],
)

summarizer_agent = Agent(
    name="Summarizer Agent",
    instructions=(
        "You are a summarizer agent tasked with condensing the news content into a concise summary. "
        "Ensure that the summary captures all essential points. Be clear and succinct."
    ),
    functions=[summarize_content, handoff_to_editor],
)

editor_agent = Agent(
    name="Editor Agent",
    instructions=(
        "You are an editor agent responsible for composing a polished editorial article. "
        "Utilize the analysis, fact-check results, and summary to create a coherent and engaging piece. "
        "Ensure the editorial is well-structured and free of errors."
    ),
    functions=[generate_editorial],
)

# Define the workflow execution
def run_agents(url):
    try:
        # Step 1: Scrape Website
        scraped_content = scrape_website(url)
        if not scraped_content:
            st.error("🔴 Failed to scrape the website. Please check the URL and try again.")
            return None
        st.success("✅ Website scraped successfully.")

        # Step 2: Analyze Content
        analysis = analyze_website_content(scraped_content)
        if not analysis:
            st.error("🔴 Failed to analyze content.")
            return None
        st.info("📝 Content analyzed.")

        # Step 3: Fact Check
        fact_check = fact_check_content(scraped_content)
        if not fact_check:
            st.error("🔴 Failed to fact-check content.")
            return None
        st.info("🔍 Fact-checked the content.")

        # Step 4: Summarize
        summary = summarize_content(scraped_content)
        if not summary:
            st.error("🔴 Failed to summarize content.")
            return None
        st.info("📝 Content summarized.")

        # Step 5: Generate Editorial
        editorial = generate_editorial(analysis, fact_check, summary)
        if not editorial:
            st.error("🔴 Failed to generate editorial.")
            return None
        st.success("📰 Editorial generated successfully.")

        return {
            "Analysis": analysis,
            "Fact Check": fact_check,
            "Summary": summary,
            "Editorial": editorial
        }
    except Exception as e:
        st.error(f"An unexpected error occurred: {str(e)}")
        return None

# Streamlit App Main Interface
with st.form(key='news_form'):
    url = st.text_input("Enter News Article URL:", "")
    submit_button = st.form_submit_button(label='Generate Editorial')

if submit_button:
    if not url:
        st.error("Please enter a valid URL.")
    else:
        with st.spinner("Processing..."):
            results = run_agents(url)
            if results:
                st.subheader("🔍 Analysis")
                st.write(results["Analysis"])

                st.subheader("🔍 Fact Check")
                st.write(results["Fact Check"])

                st.subheader("📝 Summary")
                st.write(results["Summary"])

                st.subheader("📰 Editorial")
                st.write(results["Editorial"])
