import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const feedbackSchema = z.object({
    accounting_sufficiency: z.enum(["Sufficient", "Insufficient"], {
        required_error: "Please select an option",
    }),
    insufficient_reasons: z.array(z.string()).default([]),
    desired_features: z.array(z.string()).default([]),
    free_description: z.string().optional(),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

const INSUFFICIENT_REASONS = [
    "Not enough supported chains",
    "Not enough supported wallets/exchanges",
    "I want financial statements to be easier to create",
    "The operation is difficult to understand",
    "Other",
];

const DESIRED_FEATURES = [
    "Tax calculation and document creation function",
    "Assistance for financial strategy decisions",
    "Payment function and instant journal entry from payment",
    "Salary payment function via crypto",
    "API integration with ERP tools",
    "Fundraising function via crypto",
    "Other",
];

export function FeedbackForm({ onSuccess }: { onSuccess: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FeedbackFormValues>({
        resolver: zodResolver(feedbackSchema),
        defaultValues: {
            accounting_sufficiency: "Sufficient",
            insufficient_reasons: [],
            desired_features: [],
            free_description: "",
        },
    });

    const sufficiency = form.watch("accounting_sufficiency");

    async function onSubmit(values: FeedbackFormValues) {
        setIsSubmitting(true);
        try {
            const entryParams = JSON.parse(sessionStorage.getItem("entry_params") || "{}");

            const { error } = await supabase.from("user_feedbacks").insert({
                accounting_sufficiency: values.accounting_sufficiency,
                insufficient_reasons: values.accounting_sufficiency === "Insufficient" ? values.insufficient_reasons : [],
                desired_features: values.desired_features,
                free_description: values.free_description,
                entry_params: entryParams,
            });

            if (error) throw error;

            toast.success("Thank you for your feedback!");
            onSuccess();
        } catch (error: any) {
            console.error("Error submitting feedback:", error);
            toast.error("Failed to submit feedback. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="accounting_sufficiency"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>How do you feel about the automated accounting feature?</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex flex-col space-y-1"
                                >
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value="Sufficient" />
                                        </FormControl>
                                        <FormLabel className="font-normal">Sufficient</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value="Insufficient" />
                                        </FormControl>
                                        <FormLabel className="font-normal">Insufficient</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {sufficiency === "Insufficient" && (
                    <FormField
                        control={form.control}
                        name="insufficient_reasons"
                        render={() => (
                            <FormItem>
                                <div className="mb-4">
                                    <FormLabel>What points were insufficient? (Multiple choices possible)</FormLabel>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {INSUFFICIENT_REASONS.map((reason) => (
                                        <FormField
                                            key={reason}
                                            control={form.control}
                                            name="insufficient_reasons"
                                            render={({ field }) => {
                                                return (
                                                    <FormItem
                                                        key={reason}
                                                        className="flex flex-row items-start space-x-3 space-y-0"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(reason)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...field.value, reason])
                                                                        : field.onChange(
                                                                            field.value?.filter(
                                                                                (value) => value !== reason
                                                                            )
                                                                        );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                            {reason}
                                                        </FormLabel>
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="desired_features"
                    render={() => (
                        <FormItem>
                            <div className="mb-4">
                                <FormLabel>Other features you would like to have (Multiple choices possible)</FormLabel>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {DESIRED_FEATURES.map((feature) => (
                                    <FormField
                                        key={feature}
                                        control={form.control}
                                        name="desired_features"
                                        render={({ field }) => {
                                            return (
                                                <FormItem
                                                    key={feature}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(feature)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...field.value, feature])
                                                                    : field.onChange(
                                                                        field.value?.filter(
                                                                            (value) => value !== feature
                                                                        )
                                                                    );
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {feature}
                                                    </FormLabel>
                                                </FormItem>
                                            );
                                        }}
                                    />
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="free_description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Comments (Optional, but greatly appreciated! Especially if you selected "Other")</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Tell us what you think..."
                                    className="resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Feedback"}
                </Button>
            </form>
        </Form>
    );
}
