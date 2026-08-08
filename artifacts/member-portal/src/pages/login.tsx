import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isSuccess } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isSuccess && user) {
      setLocation("/dashboard");
    }
  }, [isSuccess, user, setLocation]);

  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMeQueryKey(), data);
          setLocation("/dashboard");
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src={`${import.meta.env.BASE_URL}nhs-logo.png`}
            alt="National Honor Society"
            className="mb-4 h-24 w-auto"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-login">
            Leigh NHS Member Portal
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-login-subtitle">
            Sign in to access your volunteer dashboard
          </p>
        </div>

        <Card className="shadow-lg border-muted/50">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your details below to sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            {loginMutation.isError && (
              <Alert variant="destructive" className="mb-6" data-testid="alert-login-error">
                <AlertDescription>
                  {loginMutation.error?.data?.error || "We couldn't sign you in. Please check your details and try again."}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="First-Last" 
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          {...field} 
                          data-testid="input-username"
                        />
                      </FormControl>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        Use your first and last name separated by a hyphen (e.g. Alexander-Hamilton)
                      </p>
                      <details className="group mt-1 text-[13px] text-muted-foreground">
                        <summary className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline">
                          Exceptions
                        </summary>
                        <p className="mt-1">
                          If you have two last names, format it like First-Last 2ndLast.
                        </p>
                      </details>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="current-password"
                          placeholder="••••••••" 
                          {...field} 
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-[13px] text-muted-foreground mt-1">
                        Your student ID
                      </p>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full text-base font-medium" 
                  size="lg"
                  disabled={loginMutation.isPending}
                  data-testid="button-submit-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <p className="text-center text-sm text-muted-foreground mt-8" data-testid="text-support">
          Need help signing in? Contact{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="mailto:562022@my.cuhsd.org">
            562022@my.cuhsd.org
          </a>{" "}
          with questions
        </p>
      </div>
    </div>
  );
}
