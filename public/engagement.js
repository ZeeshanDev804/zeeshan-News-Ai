(function () {
  "use strict";

  const state = {
    engagements: [],
    loading: false,
  };

  function getContainer() {
    return document.getElementById(
      "engagement-container"
    );
  }

  function getVoterKey() {
    const storageKey =
      "zeeshan_news_ai_voter_key";

    let voterKey =
      localStorage.getItem(storageKey);

    if (!voterKey) {
      voterKey =
        "voter_" +
        crypto.randomUUID();

      localStorage.setItem(
        storageKey,
        voterKey
      );
    }

    return voterKey;
  }

  async function fetchEngagements() {
    state.loading = true;

    try {
      const response = await fetch(
        "/api/engagement?limit=10"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load engagement"
        );
      }

      const data =
        await response.json();

      state.engagements =
        Array.isArray(
          data.engagements
        )
          ? data.engagements
          : [];

      renderEngagements();
    } catch (error) {
      console.error(
        "Engagement load error:",
        error
      );

      renderError();
    } finally {
      state.loading = false;
    }
  }

  function renderLoading() {
    const container =
      getContainer();

    if (!container) return;

    container.innerHTML = `
      <section class="engagement-section">
        <div class="engagement-card">
          <p>
            Loading polls and quizzes...
          </p>
        </div>
      </section>
    `;
  }

  function renderError() {
    const container =
      getContainer();

    if (!container) return;

    container.innerHTML = `
      <section class="engagement-section">
        <div class="engagement-card">
          <p>
            Engagement content is
            temporarily unavailable.
          </p>
        </div>
      </section>
    `;
  }

  function renderEngagements() {
    const container =
      getContainer();

    if (!container) return;

    if (
      state.engagements.length === 0
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <section
        class="engagement-section"
        aria-label="Polls and quizzes"
      >
        <div class="engagement-heading">
          <span>COMMUNITY</span>

          <h2>
            Polls & Quizzes
          </h2>

          <p>
            Share your opinion and test
            your knowledge.
          </p>
        </div>

        <div class="engagement-list">
          ${state.engagements
            .map(
              (item) =>
                renderEngagementCard(
                  item
                )
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEngagementCard(item) {
    const options =
      Array.isArray(item.options)
        ? item.options
        : [];

    const type =
      String(
        item.type || "poll"
      ).toUpperCase();

    return `
      <article
        class="engagement-card"
        data-engagement-id="${escapeHtml(
          item.id
        )}"
      >

        <div class="engagement-type">
          ${escapeHtml(type)}
        </div>

        <h3>
          ${escapeHtml(
            item.question || ""
          )}
        </h3>

        <div class="engagement-options">

          ${options
            .map(
              (option) => `
                <button
                  type="button"
                  class="engagement-option"
                  data-poll-id="${escapeHtml(
                    item.id
                  )}"
                  data-option-key="${escapeHtml(
                    option.key
                  )}"
                >
                  ${escapeHtml(
                    option.label ||
                      option.key ||
                      ""
                  )}
                </button>
              `
            )
            .join("")}

        </div>

        <div
          class="engagement-result"
          id="engagement-result-${escapeHtml(
            item.id
          )}"
        ></div>

      </article>
    `;
  }

  async function submitVote(
    pollId,
    optionKey,
    button
  ) {
    if (!pollId || !optionKey) {
      return;
    }

    button.disabled = true;

    const card =
      button.closest(
        ".engagement-card"
      );

    const resultBox =
      card?.querySelector(
        ".engagement-result"
      );

    try {
      const response =
        await fetch(
          `/api/engagement/${encodeURIComponent(
            pollId
          )}/vote`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              optionKey,
              voterKey:
                getVoterKey(),
            }),
          }
        );

      const data =
        await response.json();

      if (
        response.status === 409
      ) {
        if (resultBox) {
          resultBox.textContent =
            "You have already voted.";
        }

        await loadResults(
          pollId,
          resultBox
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Vote failed"
        );
      }

      if (resultBox) {
        resultBox.textContent =
          "Your vote has been recorded.";
      }

      await loadResults(
        pollId,
        resultBox
      );
    } catch (error) {
      console.error(
        "Vote error:",
        error
      );

      if (resultBox) {
        resultBox.textContent =
          "Unable to submit vote right now.";
      }
    } finally {
      button.disabled = false;
    }
  }

  async function loadResults(
    pollId,
    resultBox
  ) {
    try {
      const response =
        await fetch(
          `/api/engagement/${encodeURIComponent(
            pollId
          )}/results`
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      const results =
        Array.isArray(
          data.results
        )
          ? data.results
          : [];

      if (!resultBox) {
        return;
      }

      if (results.length === 0) {
        return;
      }

      const total =
        results.reduce(
          (sum, item) =>
            sum +
            Number(
              item.votes || 0
            ),
          0
        );

      resultBox.innerHTML = `
        <div class="engagement-results">

          <strong>
            Current results
          </strong>

          ${results
            .map((item) => {
              const votes =
                Number(
                  item.votes || 0
                );

              const percentage =
                total > 0
                  ? Math.round(
                      (votes /
                        total) *
                        100
                    )
                  : 0;

              return `
                <div
                  class="engagement-result-row"
                >

                  <div>
                    <span>
                      ${escapeHtml(
                        item.option_key
                      )}
                    </span>

                    <span>
                      ${votes} votes
                    </span>
                  </div>

                  <div
                    class="engagement-result-bar"
                  >
                    <div
                      class="engagement-result-fill"
                      style="width:${percentage}%"
                    ></div>
                  </div>

                  <small>
                    ${percentage}%
                  </small>

                </div>
              `;
            })
            .join("")}

        </div>
      `;
    } catch (error) {
      console.error(
        "Results error:",
        error
      );
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function attachEvents() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".engagement-option"
          );

        if (!button) {
          return;
        }

        const pollId =
          button.dataset.pollId;

        const optionKey =
          button.dataset.optionKey;

        submitVote(
          pollId,
          optionKey,
          button
        );
      }
    );
  }

  function init() {
    const container =
      getContainer();

    if (!container) {
      return;
    }

    renderLoading();

    attachEvents();

    fetchEngagements();
  }

  window.ZeeshanEngagement = {
    init,

    refresh:
      fetchEngagements,
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();