import { describe, it, expect } from "vitest";
import { DevilsAdvocateProtocol } from "./devilsAdvocate.js";
import { detectAnchoring } from "./detectors/anchoring.js";
import { detectSocialDesirability } from "./detectors/socialDesirability.js";
import { detectOverconfidence } from "./detectors/overconfidence.js";
import { detectStatusQuo } from "./detectors/statusQuo.js";
import { detectSunkCost } from "./detectors/sunkCost.js";
import { detectConfirmation } from "./detectors/confirmation.js";
import { detectFraming } from "./detectors/framing.js";
import { detectCatastrophizing } from "./detectors/catastrophizing.js";

// Each detector: one positive, one negative. Protocol: all nine reachable,
// capped, and resettable.

describe("bias detectors", () => {
  it("anchoring fires on first-figure fixation, silent otherwise", () => {
    expect(detectAnchoring("I am stuck on the first offer of fifty")?.type).toBe("anchoring");
    expect(detectAnchoring("the market rate seems fair")).toBeNull();
  });

  it("anchoring escalates when the figure never moves", () => {
    const c = detectAnchoring("stuck on the initial number", { anchorValue: 100, currentValue: 102 });
    expect(c?.severity).toBe("MEDIUM");
  });

  it("social desirability fires on applause-seeking, silent otherwise", () => {
    expect(detectSocialDesirability("I don't want to seem cheap to them")?.type).toBe("social_desirability");
    expect(detectSocialDesirability("the numbers favor accepting")).toBeNull();
  });

  it("overconfidence fires on certainty language, silent otherwise", () => {
    expect(detectOverconfidence("this is a sure thing, no doubt")?.type).toBe("overconfidence");
    expect(detectOverconfidence("I am leaning yes but unsure")).toBeNull();
  });

  it("overconfidence escalates against weak base rates", () => {
    const c = detectOverconfidence("guaranteed win", { baseRate: 0.2 });
    expect(c?.severity).toBe("MEDIUM");
  });

  it("status quo fires on inertia language, silent otherwise", () => {
    expect(detectStatusQuo("let's not rock the boat here")?.type).toBe("status_quo");
    expect(detectStatusQuo("switching looks strictly better")).toBeNull();
  });

  it("sunk cost fires on past-spend justification, silent otherwise", () => {
    expect(detectSunkCost("we've already invested two years, can't walk away now")?.type).toBe("sunk_cost");
    expect(detectSunkCost("future returns justify continuing")).toBeNull();
  });

  it("confirmation fires on selective evidence, silent otherwise", () => {
    expect(detectConfirmation("this proves me right, ignore the critics")?.type).toBe("confirmation");
    expect(detectConfirmation("I weighed both sides")).toBeNull();
  });

  it("framing fires on loss phrasing, silent otherwise", () => {
    expect(detectFraming("the failure rate terrifies me")?.type).toBe("framing");
    expect(detectFraming("expected value is positive")).toBeNull();
  });

  it("catastrophizing fires on doom language, silent otherwise", () => {
    expect(detectCatastrophizing("it would be a total disaster")?.type).toBe("catastrophizing");
    expect(detectCatastrophizing("a setback, but recoverable")).toBeNull();
    // Review catch: bare calendar phrasing must not trip the doom marker.
    expect(detectCatastrophizing("end of quarter review looks fine")).toBeNull();
  });
});

describe("DevilsAdvocateProtocol", () => {
  it("reaches every detector through one interface", () => {
    const p = new DevilsAdvocateProtocol({ maxChallenges: 20 });
    expect(
      p.evaluate_answer({ text: "it would be devastating, I absolutely cannot risk it", context: { expectedValue: 5 } })?.type,
    ).toBe("loss_aversion");
    const cases: [string, string][] = [
      ["it would be a total disaster", "catastrophizing"],
      ["stuck on the first offer", "anchoring"],
      ["don't want to seem cheap", "social_desirability"],
      ["this is a sure thing", "overconfidence"],
      ["don't rock the boat", "status_quo"],
      ["already invested too much to quit", "sunk_cost"],
      ["this proves me right", "confirmation"],
      ["the failure rate terrifies me", "framing"],
    ];
    for (const [text, type] of cases) {
      expect(p.evaluate_answer({ text })?.type).toBe(type);
    }
  });

  it("caps challenges and resets", () => {
    const p = new DevilsAdvocateProtocol({ maxChallenges: 1 });
    expect(p.evaluate_answer({ text: "it would be a total disaster" })).toBeTruthy();
    expect(p.evaluate_answer({ text: "it would be a total disaster" })).toBeNull();
    p.reset();
    expect(p.evaluate_answer({ text: "it would be a total disaster" })).toBeTruthy();
  });

  it("stays silent on clean answers", () => {
    const p = new DevilsAdvocateProtocol();
    expect(p.evaluate_answer({ text: "the expected value is positive and the downside is capped" })).toBeNull();
  });
});
