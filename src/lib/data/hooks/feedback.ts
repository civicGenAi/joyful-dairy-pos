import { useMutation, useQuery } from "@tanstack/react-query";
import { feedbackKeys, feedbackRepo } from "@/lib/data/feedback";

export function useSubmitFeedback() {
  return useMutation({ mutationFn: feedbackRepo.submit });
}

export function useFeedbackList(page = 0, pageSize = 25) {
  return useQuery({
    queryKey: feedbackKeys.list(page),
    queryFn: () => feedbackRepo.list(page, pageSize),
  });
}

export function useFeedbackStats() {
  return useQuery({ queryKey: feedbackKeys.stats(), queryFn: feedbackRepo.stats });
}

export function useFeedbackDistribution() {
  return useQuery({
    queryKey: feedbackKeys.distribution(),
    queryFn: feedbackRepo.ratingDistribution,
  });
}

export function useFeedbackMonthly() {
  return useQuery({ queryKey: feedbackKeys.monthly(), queryFn: feedbackRepo.monthly });
}
